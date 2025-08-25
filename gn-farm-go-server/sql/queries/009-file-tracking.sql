-- name: CreateFileUpload :one
INSERT INTO file_uploads (
    public_id, file_url, file_name, file_type, file_size, folder, mime_type,
    uploaded_by_user_id, tags, metadata, is_temporary
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
) RETURNING *;

-- name: GetFileUploadByPublicID :one
SELECT * FROM file_uploads WHERE public_id = $1;

-- name: GetFileUploadByID :one
SELECT * FROM file_uploads WHERE id = $1;

-- name: UpdateFileUploadStatus :exec
UPDATE file_uploads 
SET is_temporary = $2, is_orphaned = $3, updated_at = CURRENT_TIMESTAMP
WHERE id = $1;

-- name: MarkFileForDeletion :exec
UPDATE file_uploads 
SET is_orphaned = TRUE, marked_for_deletion_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
WHERE id = $1;

-- name: DeleteFileUpload :exec
UPDATE file_uploads 
SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
WHERE id = $1;

-- name: HardDeleteFileUpload :exec
DELETE FROM file_uploads WHERE id = $1;

-- name: GetTemporaryFiles :many
SELECT * FROM file_uploads 
WHERE is_temporary = TRUE 
  AND created_at < $1
ORDER BY created_at ASC
LIMIT $2;

-- name: GetOrphanedFiles :many
SELECT * FROM file_uploads 
WHERE is_orphaned = TRUE 
  AND marked_for_deletion_at IS NOT NULL
  AND marked_for_deletion_at < $1
ORDER BY marked_for_deletion_at ASC
LIMIT $2;

-- name: GetFilesByUser :many
SELECT * FROM file_uploads 
WHERE uploaded_by_user_id = $1
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CreateFileReference :one
INSERT INTO file_references (
    file_id, entity_type, entity_id, field_name, reference_type, created_by_user_id
) VALUES (
    $1, $2, $3, $4, $5, $6
) RETURNING *;

-- name: DeleteFileReference :exec
UPDATE file_references 
SET deleted_at = CURRENT_TIMESTAMP, deleted_by_user_id = $4
WHERE file_id = $1 AND entity_type = $2 AND entity_id = $3;

-- name: HardDeleteFileReference :exec
DELETE FROM file_references 
WHERE file_id = $1 AND entity_type = $2 AND entity_id = $3;

-- name: GetFileReferences :many
SELECT fr.*, fu.public_id, fu.file_url, fu.file_name
FROM file_references fr
JOIN file_uploads fu ON fr.file_id = fu.id
WHERE fr.entity_type = $1 AND fr.entity_id = $2 AND fr.deleted_at IS NULL
ORDER BY fr.created_at ASC;

-- name: GetFileReferencesByFileID :many
SELECT * FROM file_references 
WHERE file_id = $1 AND deleted_at IS NULL
ORDER BY created_at ASC;

-- name: CountActiveReferences :one
SELECT COUNT(*) FROM file_references 
WHERE file_id = $1 AND reference_type = 'active' AND deleted_at IS NULL;

-- name: CreateFileAuditLog :one
INSERT INTO file_audit_logs (
    file_id, action, entity_type, entity_id, old_reference_count, new_reference_count,
    details, performed_by_user_id, ip_address, user_agent
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
) RETURNING *;

-- name: GetFileAuditLogs :many
SELECT fal.*, fu.public_id, fu.file_name
FROM file_audit_logs fal
LEFT JOIN file_uploads fu ON fal.file_id = fu.id
WHERE ($1::integer IS NULL OR fal.file_id = $1)
  AND ($2::text IS NULL OR fal.action = $2)
  AND ($3::integer IS NULL OR fal.performed_by_user_id = $3)
  AND fal.performed_at >= $4
  AND fal.performed_at <= $5
ORDER BY fal.performed_at DESC
LIMIT $6 OFFSET $7;

-- name: CreateCleanupJob :one
INSERT INTO file_cleanup_jobs (
    job_type, status, parameters
) VALUES (
    $1, $2, $3
) RETURNING *;

-- name: UpdateCleanupJobStatus :exec
UPDATE file_cleanup_jobs 
SET status = $2,
    files_processed = COALESCE($3, files_processed),
    files_deleted = COALESCE($4, files_deleted),
    files_failed = COALESCE($5, files_failed),
    error_message = COALESCE($6, error_message)
WHERE id = $1;

-- name: UpdateCleanupJobStatusWithTiming :exec
UPDATE file_cleanup_jobs 
SET status = $2,
    started_at = CASE WHEN $2 = 'running' THEN CURRENT_TIMESTAMP ELSE started_at END,
    completed_at = CASE WHEN $2 IN ('completed', 'failed') THEN CURRENT_TIMESTAMP ELSE completed_at END,
    files_processed = COALESCE($3, files_processed),
    files_deleted = COALESCE($4, files_deleted),
    files_failed = COALESCE($5, files_failed),
    error_message = COALESCE($6, error_message)
WHERE id = $1;

-- name: GetCleanupJob :one
SELECT * FROM file_cleanup_jobs WHERE id = $1;

-- name: GetCleanupJobs :many
SELECT * FROM file_cleanup_jobs 
WHERE ($1::text IS NULL OR job_type = $1)
  AND ($2::text IS NULL OR status = $2)
ORDER BY created_at DESC
LIMIT $3 OFFSET $4;

-- name: GetRunningCleanupJobs :many
SELECT * FROM file_cleanup_jobs 
WHERE status = 'running'
ORDER BY started_at ASC;

-- name: GetFileStatistics :one
SELECT 
    COUNT(*) as total_files,
    COUNT(*) FILTER (WHERE is_temporary = TRUE) as temporary_files,
    COUNT(*) FILTER (WHERE is_orphaned = TRUE) as orphaned_files,
    COUNT(*) FILTER (WHERE reference_count = 0) as zero_reference_files,
    COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) as deleted_files,
    SUM(file_size) as total_size,
    SUM(file_size) FILTER (WHERE is_orphaned = TRUE) as orphaned_size
FROM file_uploads;

-- name: GetFilesByType :many
SELECT file_type, COUNT(*) as count, SUM(file_size) as total_size
FROM file_uploads 
WHERE deleted_at IS NULL
GROUP BY file_type
ORDER BY count DESC;

-- name: GetOldestTemporaryFiles :many
SELECT * FROM file_uploads 
WHERE is_temporary = TRUE 
  AND created_at < NOW() - INTERVAL '1 hour'
ORDER BY created_at ASC
LIMIT $1;

-- name: GetFilesMarkedForDeletion :many
SELECT * FROM file_uploads 
WHERE marked_for_deletion_at IS NOT NULL 
  AND marked_for_deletion_at < NOW() - INTERVAL '7 days'
  AND deleted_at IS NULL
ORDER BY marked_for_deletion_at ASC
LIMIT $1;

-- name: UpdateFileMetadata :exec
UPDATE file_uploads 
SET metadata = $2, tags = $3, updated_at = CURRENT_TIMESTAMP
WHERE id = $1;

-- name: SearchFiles :many
SELECT * FROM file_uploads 
WHERE deleted_at IS NULL
  AND ($1::text IS NULL OR file_name ILIKE '%' || $1 || '%')
  AND ($2::text IS NULL OR file_type = $2)
  AND ($3::integer IS NULL OR uploaded_by_user_id = $3)
  AND ($4::boolean IS NULL OR is_temporary = $4)
  AND ($5::boolean IS NULL OR is_orphaned = $5)
ORDER BY created_at DESC
LIMIT $6 OFFSET $7;