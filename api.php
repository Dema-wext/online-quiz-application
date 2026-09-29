<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

class ApiException extends RuntimeException
{
    public int $status;

    public function __construct(string $message, int $status)
    {
        parent::__construct($message);
        $this->status = $status;
    }
}

function respond(array $data, int $status = 200): void
{
    http_response_code($status);
    $data['csrfToken'] = $_SESSION['csrf_token'] ?? null;
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function require_method(string $expected): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== $expected) {
        throw new ApiException('Method not allowed.', 405);
    }
}

function require_csrf(): void
{
    $provided = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    $expected = $_SESSION['csrf_token'] ?? '';
    if ($expected === '' || !hash_equals($expected, $provided)) {
        throw new ApiException('Your session expired. Refresh the page and try again.', 403);
    }
}

function require_user(): array
{
    $user = $_SESSION['user'] ?? null;
    if (!is_array($user)) {
        throw new ApiException('Please log in first.', 401);
    }
    return $user;
}

function require_admin(): array
{
    $user = require_user();
    if (($user['role'] ?? '') !== 'admin') {
        throw new ApiException('Administrator access is required.', 403);
    }
    return $user;
}

function read_question(array $input): array
{
    $question = trim((string)($input['question'] ?? ''));
    $topic = trim((string)($input['topic'] ?? ''));
    $options = $input['options'] ?? null;
    $correct = strtoupper((string)($input['correctOption'] ?? ''));
    $sortOrder = filter_var($input['sortOrder'] ?? 0, FILTER_VALIDATE_INT);

    if ($question === '' || mb_strlen($question) > 500) {
        throw new ApiException('Question text is required and must be under 500 characters.', 422);
    }
    if ($topic === '' || mb_strlen($topic) > 80) {
        throw new ApiException('Topic is required and must be under 80 characters.', 422);
    }
    if (!is_array($options) || count($options) !== 4) {
        throw new ApiException('Provide exactly four answer options.', 422);
    }
    foreach ($options as $option) {
        if (!is_string($option) || trim($option) === '' || mb_strlen($option) > 255) {
            throw new ApiException('Each answer option is required and must be under 255 characters.', 422);
        }
    }
    if (!in_array($correct, ['A', 'B', 'C', 'D'], true)) {
        throw new ApiException('Choose which answer option is correct.', 422);
    }

    return [
        'question' => $question,
        'topic' => $topic,
        'options' => array_map('trim', array_values($options)),
        'correct' => $correct,
        'sortOrder' => $sortOrder === false ? 0 : max(0, $sortOrder),
    ];
}

try {
    require_once __DIR__ . '/config.php';
    start_app_session();
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }

    $action = (string)($_GET['action'] ?? '');
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $rawBody = file_get_contents('php://input');
    $input = $rawBody === '' ? [] : json_decode($rawBody, true);
    if (!is_array($input)) {
        throw new ApiException('Request body must be valid JSON.', 400);
    }

    if ($method === 'POST') {
        require_csrf();
    }

    switch ($action) {
        case 'session':
            require_method('GET');
            respond(['user' => $_SESSION['user'] ?? null]);

        case 'register':
            require_method('POST');
            $name = trim((string)($input['name'] ?? ''));
            $email = strtolower(trim((string)($input['email'] ?? '')));
            $password = (string)($input['password'] ?? '');
            if ($name === '' || mb_strlen($name) > 80 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                throw new ApiException('Enter a name and a valid email address.', 422);
            }
            if (strlen($password) < 8 || strlen($password) > 72) {
                throw new ApiException('Password must be between 8 and 72 characters.', 422);
            }
            $statement = database()->prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)');
            try {
                $statement->execute([$name, $email, password_hash($password, PASSWORD_DEFAULT)]);
            } catch (PDOException $exception) {
                if ($exception->getCode() === '23000') {
                    throw new ApiException('An account with that email already exists.', 409);
                }
                throw $exception;
            }
            session_regenerate_id(true);
            $_SESSION['user'] = ['id' => (int)database()->lastInsertId(), 'name' => $name, 'email' => $email, 'role' => 'user'];
            respond(['user' => $_SESSION['user']]);

        case 'login':
            require_method('POST');
            $email = strtolower(trim((string)($input['email'] ?? '')));
            $statement = database()->prepare('SELECT id, name, email, password_hash, role FROM users WHERE email = ?');
            $statement->execute([$email]);
            $account = $statement->fetch();
            if (!$account || !password_verify((string)($input['password'] ?? ''), $account['password_hash'])) {
                throw new ApiException('Email or password is incorrect.', 401);
            }
            session_regenerate_id(true);
            unset($account['password_hash']);
            $account['id'] = (int)$account['id'];
            $_SESSION['user'] = $account;
            respond(['user' => $account]);

        case 'logout':
            require_method('POST');
            $_SESSION = [];
            session_regenerate_id(true);
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
            respond(['ok' => true]);

        case 'questions':
            require_method('GET');
            require_user();
            $rows = database()->query('SELECT id, question_text, topic, option_a, option_b, option_c, option_d FROM questions WHERE is_active = 1 ORDER BY sort_order, id')->fetchAll();
            $questions = array_map(static function (array $row): array {
                return [
                    'id' => (int)$row['id'],
                    'question' => $row['question_text'],
                    'topic' => $row['topic'],
                    'options' => [$row['option_a'], $row['option_b'], $row['option_c'], $row['option_d']],
                ];
            }, $rows);
            respond(['questions' => $questions]);

        case 'submit':
            require_method('POST');
            $user = require_user();
            $answers = $input['answers'] ?? null;
            if (!is_array($answers)) {
                throw new ApiException('Quiz answers are missing.', 422);
            }
            $questions = database()->query('SELECT id, question_text, option_a, option_b, option_c, option_d, correct_option FROM questions WHERE is_active = 1 ORDER BY sort_order, id')->fetchAll();
            if (!$questions) {
                throw new ApiException('There are no active quiz questions yet.', 422);
            }
            $validIds = array_map(static fn(array $row): string => (string)$row['id'], $questions);
            foreach ($answers as $id => $choice) {
                if (!in_array((string)$id, $validIds, true) || ($choice !== null && !in_array($choice, ['A', 'B', 'C', 'D'], true))) {
                    throw new ApiException('One or more submitted answers are invalid.', 422);
                }
            }

            $db = database();
            $db->beginTransaction();
            $correctCount = 0;
            $insertAttempt = $db->prepare('INSERT INTO attempts (user_id, score, total_questions) VALUES (?, 0, ?)');
            $insertAttempt->execute([$user['id'], count($questions)]);
            $attemptId = (int)$db->lastInsertId();
            $insertAnswer = $db->prepare('INSERT INTO attempt_answers (attempt_id, question_id, question_text, options_json, selected_option, correct_option) VALUES (?, ?, ?, ?, ?, ?)');
            foreach ($questions as $question) {
                $choice = $answers[(string)$question['id']] ?? null;
                $correctCount += $choice === $question['correct_option'] ? 1 : 0;
                $insertAnswer->execute([
                    $attemptId,
                    $question['id'],
                    $question['question_text'],
                    json_encode([$question['option_a'], $question['option_b'], $question['option_c'], $question['option_d']], JSON_UNESCAPED_UNICODE),
                    $choice,
                    $question['correct_option'],
                ]);
            }
            $updateAttempt = $db->prepare('UPDATE attempts SET score = ? WHERE id = ?');
            $updateAttempt->execute([$correctCount, $attemptId]);
            $db->commit();
            respond(['attemptId' => $attemptId, 'score' => $correctCount, 'total' => count($questions)]);

        case 'history':
            require_method('GET');
            $user = require_user();
            $statement = database()->prepare('SELECT id, score, total_questions, created_at FROM attempts WHERE user_id = ? ORDER BY created_at DESC, id DESC');
            $statement->execute([$user['id']]);
            respond(['attempts' => $statement->fetchAll()]);

        case 'attempt':
            require_method('GET');
            $user = require_user();
            $attemptId = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT);
            if (!$attemptId) {
                throw new ApiException('A valid attempt ID is required.', 422);
            }
            $statement = database()->prepare('SELECT id, user_id, score, total_questions, created_at FROM attempts WHERE id = ?');
            $statement->execute([$attemptId]);
            $attempt = $statement->fetch();
            if (!$attempt || ((int)$attempt['user_id'] !== (int)$user['id'] && $user['role'] !== 'admin')) {
                throw new ApiException('That quiz result was not found.', 404);
            }
            $statement = database()->prepare('SELECT question_text, options_json, selected_option, correct_option FROM attempt_answers WHERE attempt_id = ? ORDER BY id');
            $statement->execute([$attemptId]);
            $attempt['answers'] = array_map(static function (array $answer): array {
                $answer['options'] = json_decode($answer['options_json'], true) ?: [];
                unset($answer['options_json']);
                return $answer;
            }, $statement->fetchAll());
            respond(['attempt' => $attempt]);

        case 'admin-questions':
            require_method('GET');
            require_admin();
            $rows = database()->query('SELECT id, question_text, topic, option_a, option_b, option_c, option_d, correct_option, sort_order FROM questions WHERE is_active = 1 ORDER BY sort_order, id')->fetchAll();
            respond(['questions' => $rows]);

        case 'admin-save':
            require_method('POST');
            require_admin();
            $question = read_question($input);
            $values = [$question['question'], $question['topic'], ...$question['options'], $question['correct'], $question['sortOrder']];
            $id = filter_var($input['id'] ?? null, FILTER_VALIDATE_INT);
            if ($id) {
                $values[] = $id;
                $statement = database()->prepare('UPDATE questions SET question_text = ?, topic = ?, option_a = ?, option_b = ?, option_c = ?, option_d = ?, correct_option = ?, sort_order = ? WHERE id = ? AND is_active = 1');
                $statement->execute($values);
                if ($statement->rowCount() === 0) {
                    $exists = database()->prepare('SELECT id FROM questions WHERE id = ? AND is_active = 1');
                    $exists->execute([$id]);
                    if (!$exists->fetch()) {
                        throw new ApiException('Question not found.', 404);
                    }
                }
                respond(['ok' => true, 'message' => 'Question updated.']);
            }
            $statement = database()->prepare('INSERT INTO questions (question_text, topic, option_a, option_b, option_c, option_d, correct_option, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
            $statement->execute($values);
            respond(['ok' => true, 'message' => 'Question added.']);

        case 'admin-delete':
            require_method('POST');
            require_admin();
            $id = filter_var($input['id'] ?? null, FILTER_VALIDATE_INT);
            if (!$id) {
                throw new ApiException('A valid question ID is required.', 422);
            }
            $statement = database()->prepare('UPDATE questions SET is_active = 0 WHERE id = ? AND is_active = 1');
            $statement->execute([$id]);
            if ($statement->rowCount() !== 1) {
                throw new ApiException('Question not found.', 404);
            }
            respond(['ok' => true]);

        default:
            throw new ApiException('Endpoint not found.', 404);
    }
} catch (ApiException $exception) {
    respond(['error' => $exception->getMessage()], $exception->status);
} catch (Throwable $exception) {
    if (isset($db) && $db instanceof PDO && $db->inTransaction()) {
        $db->rollBack();
    }
    error_log($exception->__toString());
    respond(['error' => 'The server could not complete that request. Check the PHP error log.'], 500);
}