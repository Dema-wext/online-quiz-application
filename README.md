# QuickQuiz

A PHP and MySQL quiz app with account registration, saved attempts, answer reviews, and an administrator question manager.

## Run locally with XAMPP

1. Put the project folder in XAMPP's `htdocs` directory.
2. Start Apache and MySQL in the XAMPP Control Panel.
3. Open phpMyAdmin at `http://localhost/phpmyadmin` and import `database.sql`.
4. Visit `http://localhost/Online%20Application/` and register an account.
5. To grant that account admin access, open the `quickquiz` database's SQL tab and run this with the registered email:

   ```sql
   UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
   ```

6. Log out and back in. Admins can open **Manage quiz** to add, edit, and archive questions.

The local database defaults in `config.php` match a standard XAMPP installation. The app also reads `DB_HOST`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` environment variables. In production, set `APP_ENV=production` and use a dedicated database user with a non-empty password.

## Publish the source on GitHub

Create an empty repository on GitHub, then open this folder in VS Code. If Git is available, use **Source Control** in the Activity Bar, select **Initialize Repository**, then select **Publish to GitHub** and choose whether the repository should be public or private. Review the staged files before publishing; `.gitignore` excludes local environment files and logs.

If Git is unavailable on your computer, open the new repository on GitHub, choose **Add file** → **Upload files**, select the project files, and commit the upload. Do not upload production credentials or database dumps containing real user data.

GitHub is suitable for storing and versioning this source code. **GitHub Pages cannot run this app's PHP API or MySQL database.** To make the app available online, use a hosting provider that supports PHP and MySQL, configure the database environment variables there, import `database.sql`, and point the hosted app at that database. Do not commit production credentials.