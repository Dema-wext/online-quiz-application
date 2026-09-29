CREATE DATABASE IF NOT EXISTS quickquiz
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE quickquiz;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS questions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  question_text VARCHAR(500) NOT NULL,
  topic VARCHAR(80) NOT NULL,
  option_a VARCHAR(255) NOT NULL,
  option_b VARCHAR(255) NOT NULL,
  option_c VARCHAR(255) NOT NULL,
  option_d VARCHAR(255) NOT NULL,
  correct_option CHAR(1) NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT questions_correct_option CHECK (correct_option IN ('A', 'B', 'C', 'D'))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS attempts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  score INT UNSIGNED NOT NULL,
  total_questions INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT attempts_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS attempt_answers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  attempt_id INT UNSIGNED NOT NULL,
  question_id INT UNSIGNED NULL,
  question_text VARCHAR(500) NOT NULL,
  options_json LONGTEXT NOT NULL,
  selected_option CHAR(1) NULL,
  correct_option CHAR(1) NOT NULL,
  CONSTRAINT attempt_answers_attempt_fk FOREIGN KEY (attempt_id) REFERENCES attempts(id) ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT INTO questions (question_text, topic, option_a, option_b, option_c, option_d, correct_option, sort_order)
SELECT seed.question_text, seed.topic, seed.option_a, seed.option_b, seed.option_c, seed.option_d, seed.correct_option, seed.sort_order
FROM (
  SELECT 'Which planet has the most moons currently known?' AS question_text, 'Space' AS topic, 'Jupiter' AS option_a, 'Saturn' AS option_b, 'Neptune' AS option_c, 'Uranus' AS option_d, 'B' AS correct_option, 1 AS sort_order
  UNION ALL SELECT 'What is the only mammal capable of true flight?', 'Nature', 'Flying squirrel', 'Sugar glider', 'Bat', 'Colugo', 'C', 2
  UNION ALL SELECT 'In which city would you find the Prado Museum?', 'Culture', 'Rome', 'Madrid', 'Lisbon', 'Seville', 'B', 3
  UNION ALL SELECT 'What is the chemical symbol for potassium?', 'Science', 'P', 'Po', 'K', 'Pt', 'C', 4
  UNION ALL SELECT 'Which ocean is the deepest?', 'Geography', 'Atlantic', 'Indian', 'Arctic', 'Pacific', 'D', 5
  UNION ALL SELECT 'Who wrote the novel Frankenstein?', 'Literature', 'Mary Shelley', 'Jane Austen', 'Virginia Woolf', 'Emily Bronte', 'A', 6
  UNION ALL SELECT 'What is the smallest prime number?', 'Numbers', '0', '1', '2', '3', 'C', 7
  UNION ALL SELECT 'Which instrument has 47 strings and 7 pedals?', 'Music', 'Cello', 'Harp', 'Sitar', 'Accordion', 'B', 8
  UNION ALL SELECT 'What is the capital city of New Zealand?', 'Places', 'Auckland', 'Christchurch', 'Hamilton', 'Wellington', 'D', 9
  UNION ALL SELECT 'Which gas makes up most of Earth''s atmosphere?', 'Science', 'Oxygen', 'Carbon dioxide', 'Nitrogen', 'Argon', 'C', 10
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM questions LIMIT 1);