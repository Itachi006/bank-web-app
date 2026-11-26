# Bank Account Management & Transaction System — Web App ( northstar bank )

Web version of the Core Java + JDBC + MySQL console banking system. Same features, now with a browser UI:

- Open an account (name, 4-digit PIN, optional initial deposit) and get an account number
- Log in with account number + PIN
- Deposit, withdraw (overdraft protected), and transfer to another account
- Transaction history (newest first)

## Tech stack

| Layer | Technology |
|-------|-----------|
| Backend | Java 17+, Spring Boot 3 (REST API), plain **JDBC** (`DataSource`, `PreparedStatement`) |
| Database | **MySQL** (profile `mysql`) or embedded **H2** (default, zero setup) |
| Frontend | HTML, CSS, vanilla JavaScript (served from `src/main/resources/static`) |

## Run it (needs Java 17+ and Maven)

```bash
mvn spring-boot:run
```

Open <http://localhost:8080>. The default profile uses an embedded H2 database saved in `./data`, so nothing else needs installing.

### Run with MySQL

```bash
export DB_URL="jdbc:mysql://localhost:3306/banking_db?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC"
export DB_USER=root
export DB_PASSWORD=your_password
mvn spring-boot:run -Dspring-boot.run.profiles=mysql
```

Tables are created automatically at startup from `src/main/resources/schema.sql` (`banking_db.sql` is the same schema if you prefer to run it by hand).

> **Upgrading from the console app's database?** The PIN column is now `pin_hash` (BCrypt hash, up to 60 chars) instead of plain-text `pin`. Use a fresh database, or drop the old `transactions` and `accounts` tables first.

## Project layout

```
src/main/java/com/bank/
  BankApplication.java    Spring Boot entry point
  BankController.java     REST endpoints + login sessions + error mapping
  BankService.java        Business rules + JDBC (transactions, locking)
  BankException.java      Business-rule errors (HTTP 400)
src/main/resources/
  schema.sql              accounts + transactions tables
  application.properties  H2 default config
  application-mysql.properties
  static/                 index.html, style.css, app.js
banking_db.sql            Manual MySQL schema script
```

## REST API

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/accounts` | no | `{holderName, pin, initialDeposit}` → new account number |
| POST | `/api/login` | no | `{accountId, pin}` → bearer token |
| GET | `/api/me` | yes | Name + current balance |
| POST | `/api/me/deposit` | yes | `{amount}` |
| POST | `/api/me/withdraw` | yes | `{amount}` |
| POST | `/api/me/transfer` | yes | `{toAccountId, amount}` |
| GET | `/api/me/transactions` | yes | History, newest first |
| POST | `/api/logout` | yes | End session |

Authenticated calls send `Authorization: Bearer <token>`.

## Engineering notes

- **ACID**: every multi-step operation turns auto-commit off, commits only after all statements succeed, and rolls back on any failure.
- **Pessimistic locking**: `SELECT ... FOR UPDATE` on the rows involved in withdrawals, deposits and transfers.
- **Deadlock-safe transfers**: rows are always locked lowest `account_id` first.
- **Exact money math**: `BigDecimal` in Java, `DECIMAL(12,2)` in SQL.
- **SQL injection safe**: parameterised `PreparedStatement` everywhere; the UI renders data with `textContent`.
- **PINs are BCrypt-hashed** (the two main limitations of the console version are fixed here).
- Credentials come from environment variables, not source code.

## Push to GitHub

```bash
cd bank-web-app
git init
git add .
git commit -m "Add web version of banking system"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```



## Deploy online 

1. Push this project to your public GitHub repo (see above).
2. On <https://render.com> choose **New → Web Service**, connect the repo, and select **Docker** as the runtime (the included `Dockerfile` is used automatically).
3. Pick the **Free** plan and deploy. Render sets `PORT`; the app reads it.
4. Open the URL Render gives you.

By default the app uses embedded H2, so data resets when the free service restarts. For permanent data, create a free hosted MySQL and add these environment variables in Render:

| Variable | Value |
|----------|-------|
| `SPRING_PROFILES_ACTIVE` | `mysql` |
| `DB_URL` | `jdbc:mysql://<host>:<port>/<db>?useSSL=true&serverTimezone=UTC` |
| `DB_USER` | your DB user |
| `DB_PASSWORD` | your DB password |

Never commit these values to a public repo; set them only in the host's dashboard.
