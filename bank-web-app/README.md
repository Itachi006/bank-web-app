# Northstar Bank — Banking Web Application

**Live demo:** https://itachi006.github.io/bank-web-app/ (runs in your browser; try account `1` / PIN `1234`)

A browser-based banking application built with Java 17, Spring Boot 3, JDBC, H2/MySQL, and vanilla HTML/CSS/JavaScript.

> **Important:** This is an educational/portfolio project, not a real banking product. Do not use it to hold real funds or sensitive personal information. Before production use, add a persistent session store, session expiry/revocation, rate limiting and lockout, CSRF protections appropriate to the chosen auth model, HTTPS, audit logging, secrets management, monitoring, backups, and a security review.

## Features

- Open an account with a generated account number and BCrypt-hashed 4-digit PIN.
- Sign in with account number and PIN; authenticated REST calls use bearer tokens.
- View account balance and recent transaction history.
- Deposit, withdraw with overdraft protection, and transfer between accounts.
- JDBC prepared statements, `BigDecimal` money arithmetic, database transactions, and deterministic account-row lock ordering for transfers.
- Responsive browser interface served by Spring Boot.

## Requirements

- Java 17 or newer
- Maven 3.8+

## Run locally (H2, no database installation)

```bash
mvn spring-boot:run
```

Open <http://localhost:8080>. H2 data is stored under `./data` and is excluded from Git.

## Run with MySQL

Create a MySQL user/database or use a user with permission to create the database, then set:

```bash
export DB_URL='jdbc:mysql://localhost:3306/banking_db?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC'
export DB_USER='root'
export DB_PASSWORD='your_password'
mvn spring-boot:run -Dspring-boot.run.profiles=mysql
```

The schema is initialized from `src/main/resources/schema.sql`. For an existing console-app database with plaintext PINs, use a fresh database; plaintext PINs cannot be used as BCrypt hashes.

## REST API

| Method | Path | Authentication | Purpose |
|---|---|---|---|
| POST | `/api/accounts` | No | `{ "holderName": "Asha", "pin": "1234", "initialDeposit": 500 }` |
| POST | `/api/login` | No | `{ "accountId": 100001, "pin": "1234" }` |
| GET | `/api/me` | Bearer token | Account name and balance |
| POST | `/api/me/deposit` | Bearer token | `{ "amount": 100 }` |
| POST | `/api/me/withdraw` | Bearer token | `{ "amount": 50 }` |
| POST | `/api/me/transfer` | Bearer token | `{ "toAccountId": 100002, "amount": 25 }` |
| GET | `/api/me/transactions` | Bearer token | Newest-first history |
| POST | `/api/logout` | Bearer token | Revoke current in-memory token |

## Build and test

```bash
mvn clean package
```

GitHub Actions runs the Maven build and a smoke test that creates an account, logs in, deposits money, and checks the resulting balance on pushes and pull requests.

## Deploy on Render

1. Push this repository to GitHub.
2. In Render, choose **New → Web Service**, connect the repository, and select **Docker**.
3. Deploy. The Dockerfile builds the JAR and starts the app; the app listens on Render's `PORT` environment variable.
4. For persistent data, attach a supported persistent disk and configure a production database. H2 on an ephemeral container filesystem is not durable across restarts/redeploys.

For MySQL, add these environment variables in Render:

- `SPRING_PROFILES_ACTIVE=mysql`
- `DB_URL=jdbc:mysql://HOST:3306/DATABASE?useSSL=true&serverTimezone=UTC`
- `DB_USER=...`
- `DB_PASSWORD=...`

Never commit database credentials to GitHub.

## Push to GitHub

Create an empty repository on GitHub, then from this project directory:

```bash
git init
git add .
git commit -m "Build banking web application"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

Open the repository's **Actions** tab and confirm that **Build and smoke test** passes.
