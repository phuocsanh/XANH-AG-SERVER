-- +goose Up
-- +goose StatementBegin
-- Create table for chat conversation metadata in PostgreSQL
CREATE TABLE IF NOT EXISTS chat_conversations (
    conversation_id VARCHAR(255) PRIMARY KEY,
    conversation_type VARCHAR(50) NOT NULL, -- 'direct' or 'group'
    conversation_name VARCHAR(255),
    created_by INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create table for chat conversation participants
CREATE TABLE IF NOT EXISTS chat_participants (
    id SERIAL PRIMARY KEY,
    conversation_id VARCHAR(255) NOT NULL,
    user_id INT NOT NULL,
    role VARCHAR(50) DEFAULT 'member', -- 'admin' or 'member'
    joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMPTZ,
    
    CONSTRAINT fk_conversation
        FOREIGN KEY (conversation_id)
        REFERENCES chat_conversations (conversation_id)
        ON DELETE CASCADE,
        
    CONSTRAINT unique_conversation_user
        UNIQUE (conversation_id, user_id)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_participants_user_id ON chat_participants (user_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_conversation_id ON chat_participants (conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_created_by ON chat_conversations (created_by);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_updated_at ON chat_conversations (updated_at);

-- Add comments
COMMENT ON TABLE chat_conversations IS 'Stores metadata for chat conversations';
COMMENT ON TABLE chat_participants IS 'Stores participants of chat conversations';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS chat_participants;
DROP TABLE IF EXISTS chat_conversations;
-- +goose StatementEnd
