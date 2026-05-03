-- Create musik (music) table
CREATE TABLE musik (
  id_musik BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  channel VARCHAR(255),
  youtube_id VARCHAR(255),
  thumbnail_url VARCHAR(500),
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index untuk pencarian
CREATE INDEX idx_musik_category ON musik(category);
CREATE INDEX idx_musik_is_active ON musik(is_active);
CREATE INDEX idx_musik_sort_order ON musik(sort_order);

-- Insert sample data (optional - sesuaikan dengan data yang ada)
INSERT INTO musik (title, category, channel, youtube_id, thumbnail_url, sort_order) VALUES
('Stress Meditation Music', 'Relaksasi', 'Relaxing Soul', 'inpok4MKVLM', NULL, 1),
('Calm & Rain Piano', 'Relaksasi', 'Relaxing Ghibli', 'rUxyKA_-grg', NULL, 2),
('Quiet Storm', 'Relaksasi', 'Lofi Girl Relax', '4xDzrJKXOOY', NULL, 3),
('Ocean Breeze', 'Relaksasi', 'Mindful Audio', 'WHPEKLQID4U', NULL, 4),
('Gentle Forest', 'Relaksasi', 'Nature Sounds', 'eKFTSSKCzWA', NULL, 5),
('Breath Easy', 'Fokus Belajar', 'Chillhop Music', 'HluANRwPyNo', NULL, 6),
('Deep Focus Flow', 'Fokus Belajar', 'Lofi Chill', '5qap5aO4i9A', NULL, 7),
('Study with Me', 'Fokus Belajar', 'Chillhop Music', 'lTRiuFIWV54', NULL, 8);
