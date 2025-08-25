-- +goose Up
-- +goose StatementBegin

-- Bảng theo dõi file uploads với reference counting và audit trail
CREATE TABLE IF NOT EXISTS file_uploads (
    id SERIAL PRIMARY KEY,
    public_id VARCHAR(255) UNIQUE NOT NULL, -- Cloudinary public_id
    file_url TEXT NOT NULL, -- URL đầy đủ của file
    file_name VARCHAR(255) NOT NULL, -- Tên file gốc
    file_type VARCHAR(100) NOT NULL, -- image, video, document, etc.
    file_size BIGINT NOT NULL, -- Kích thước file (bytes)
    folder VARCHAR(255), -- Thư mục lưu trữ
    mime_type VARCHAR(100), -- MIME type của file
    
    -- Reference counting fields
    reference_count INTEGER DEFAULT 0, -- Số lượng tham chiếu hiện tại
    is_temporary BOOLEAN DEFAULT TRUE, -- File tạm thời chưa được sử dụng
    is_orphaned BOOLEAN DEFAULT FALSE, -- File bị mồ côi
    
    -- Metadata
    uploaded_by_user_id INTEGER, -- User upload file
    tags TEXT[] DEFAULT ARRAY[]::TEXT[], -- Tags để phân loại
    metadata JSONB DEFAULT '{}'::JSONB, -- Metadata bổ sung
    
    -- Audit trail
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    marked_for_deletion_at TIMESTAMPTZ, -- Thời điểm đánh dấu xóa
    deleted_at TIMESTAMPTZ, -- Thời điểm xóa thực tế
    
    -- Foreign key constraints
    FOREIGN KEY (uploaded_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Bảng theo dõi tham chiếu file (reference tracking)
CREATE TABLE IF NOT EXISTS file_references (
    id SERIAL PRIMARY KEY,
    file_id INTEGER NOT NULL,
    entity_type VARCHAR(100) NOT NULL, -- 'product', 'user', 'chat_message', etc.
    entity_id INTEGER NOT NULL, -- ID của entity tham chiếu
    field_name VARCHAR(100), -- Tên field chứa file (product_thumb, product_pictures, etc.)
    reference_type VARCHAR(50) DEFAULT 'active', -- 'active', 'archived', 'deleted'
    
    -- Audit trail
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id INTEGER,
    deleted_at TIMESTAMPTZ,
    deleted_by_user_id INTEGER,
    
    -- Constraints
    FOREIGN KEY (file_id) REFERENCES file_uploads(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (deleted_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    
    -- Unique constraint để tránh duplicate references
    UNIQUE(file_id, entity_type, entity_id, field_name)
);

-- Bảng audit log cho file operations
CREATE TABLE IF NOT EXISTS file_audit_logs (
    id SERIAL PRIMARY KEY,
    file_id INTEGER,
    action VARCHAR(50) NOT NULL, -- 'upload', 'reference_add', 'reference_remove', 'mark_orphaned', 'cleanup', 'delete'
    entity_type VARCHAR(100), -- Entity liên quan đến action
    entity_id INTEGER,
    old_reference_count INTEGER,
    new_reference_count INTEGER,
    details JSONB DEFAULT '{}'::JSONB, -- Chi tiết bổ sung
    
    -- Audit info
    performed_by_user_id INTEGER,
    performed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    
    -- Foreign keys
    FOREIGN KEY (file_id) REFERENCES file_uploads(id) ON DELETE SET NULL,
    FOREIGN KEY (performed_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Bảng cleanup jobs tracking
CREATE TABLE IF NOT EXISTS file_cleanup_jobs (
    id SERIAL PRIMARY KEY,
    job_type VARCHAR(50) NOT NULL, -- 'orphan_cleanup', 'temporary_cleanup', 'scheduled_cleanup'
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
    
    -- Job parameters
    parameters JSONB DEFAULT '{}'::JSONB,
    
    -- Results
    files_processed INTEGER DEFAULT 0,
    files_deleted INTEGER DEFAULT 0,
    files_failed INTEGER DEFAULT 0,
    error_message TEXT,
    
    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_file_uploads_public_id ON file_uploads(public_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_temporary ON file_uploads(is_temporary) WHERE is_temporary = TRUE;
CREATE INDEX IF NOT EXISTS idx_file_uploads_orphaned ON file_uploads(is_orphaned) WHERE is_orphaned = TRUE;
CREATE INDEX IF NOT EXISTS idx_file_uploads_marked_deletion ON file_uploads(marked_for_deletion_at) WHERE marked_for_deletion_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_file_uploads_created_at ON file_uploads(created_at);
CREATE INDEX IF NOT EXISTS idx_file_uploads_user ON file_uploads(uploaded_by_user_id);

CREATE INDEX IF NOT EXISTS idx_file_references_file_id ON file_references(file_id);
CREATE INDEX IF NOT EXISTS idx_file_references_entity ON file_references(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_file_references_active ON file_references(reference_type) WHERE reference_type = 'active';

CREATE INDEX IF NOT EXISTS idx_file_audit_logs_file_id ON file_audit_logs(file_id);
CREATE INDEX IF NOT EXISTS idx_file_audit_logs_action ON file_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_file_audit_logs_performed_at ON file_audit_logs(performed_at);

CREATE INDEX IF NOT EXISTS idx_file_cleanup_jobs_status ON file_cleanup_jobs(status);
CREATE INDEX IF NOT EXISTS idx_file_cleanup_jobs_type ON file_cleanup_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_file_cleanup_jobs_created_at ON file_cleanup_jobs(created_at);

-- Trigger để tự động cập nhật updated_at
CREATE OR REPLACE FUNCTION update_file_uploads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_file_uploads_updated_at
    BEFORE UPDATE ON file_uploads
    FOR EACH ROW
    EXECUTE FUNCTION update_file_uploads_updated_at();

-- Function để tự động cập nhật reference count
CREATE OR REPLACE FUNCTION update_file_reference_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Tăng reference count khi thêm reference mới
        UPDATE file_uploads 
        SET reference_count = reference_count + 1,
            is_temporary = FALSE,
            is_orphaned = FALSE
        WHERE id = NEW.file_id;
        
        -- Log audit
        INSERT INTO file_audit_logs (file_id, action, entity_type, entity_id, new_reference_count, performed_by_user_id)
        SELECT NEW.file_id, 'reference_add', NEW.entity_type, NEW.entity_id, 
               fu.reference_count, NEW.created_by_user_id
        FROM file_uploads fu WHERE fu.id = NEW.file_id;
        
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Giảm reference count khi xóa reference
        UPDATE file_uploads 
        SET reference_count = reference_count - 1,
            is_orphaned = CASE WHEN reference_count - 1 <= 0 THEN TRUE ELSE FALSE END,
            marked_for_deletion_at = CASE WHEN reference_count - 1 <= 0 THEN CURRENT_TIMESTAMP ELSE NULL END
        WHERE id = OLD.file_id;
        
        -- Log audit
        INSERT INTO file_audit_logs (file_id, action, entity_type, entity_id, new_reference_count, performed_by_user_id)
        SELECT OLD.file_id, 'reference_remove', OLD.entity_type, OLD.entity_id, 
               fu.reference_count, OLD.deleted_by_user_id
        FROM file_uploads fu WHERE fu.id = OLD.file_id;
        
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_file_reference_count
    AFTER INSERT OR DELETE ON file_references
    FOR EACH ROW
    EXECUTE FUNCTION update_file_reference_count();

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

-- Drop triggers
DROP TRIGGER IF EXISTS trigger_update_file_reference_count ON file_references;
DROP TRIGGER IF EXISTS trigger_update_file_uploads_updated_at ON file_uploads;

-- Drop functions
DROP FUNCTION IF EXISTS update_file_reference_count();
DROP FUNCTION IF EXISTS update_file_uploads_updated_at();

-- Drop tables
DROP TABLE IF EXISTS file_cleanup_jobs;
DROP TABLE IF EXISTS file_audit_logs;
DROP TABLE IF EXISTS file_references;
DROP TABLE IF EXISTS file_uploads;

-- +goose StatementEnd