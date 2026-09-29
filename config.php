<?php
declare(strict_types=1);

$databaseHost = getenv('DB_HOST');
$databaseName = getenv('DB_NAME');
$databaseUser = getenv('DB_USER');
$databasePassword = getenv('DB_PASSWORD');

define('DB_HOST', $databaseHost === false ? '127.0.0.1' : $databaseHost);
define('DB_NAME', $databaseName === false ? 'quickquiz' : $databaseName);
define('DB_USER', $databaseUser === false ? 'root' : $databaseUser);
define('DB_PASSWORD', $databasePassword === false ? '' : $databasePassword);

if (getenv('APP_ENV') === 'production' && (DB_USER === 'root' || DB_PASSWORD === '')) {
    throw new RuntimeException('Set a non-root database user and password for production.');
}

function start_app_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    session_set_cookie_params([
        'httponly' => true,
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'samesite' => 'Lax',
        'path' => '/',
    ]);
    session_start();
}

function database(): PDO
{
    static $connection = null;

    if ($connection instanceof PDO) {
        return $connection;
    }

    $connection = new PDO(
        'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
        DB_USER,
        DB_PASSWORD,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );

    return $connection;
}