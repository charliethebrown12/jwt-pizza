# Penetration Test Report

## Self Attack
**Peer Name:** [Your Name]

### Attack 1: Brute Force Authentication
| Item | Result |
| :--- | :--- |
| **Date** | December 3, 2025 |
| **Target** | https://pizza-service.jwtpizza329.click |
| **Classification** | Identification and Authentication Failures (OWASP A07:2021) |
| **Severity** | **High** |
| **Description** | The authentication endpoint (`/api/auth`) does not implement rate limiting. Using Burp Suite Intruder, I was able to automate login requests with a dictionary of passwords. The attack successfully identified the valid password (`secretpassword`) by returning a **200 OK** status code, distinguishing it from invalid attempts which returned **404**. |
| **Images** | ![Brute Force Results](PasswordTesting.png) |
| **Corrections** | I will add a rate-limiting middleware to the login route to block repeated requests from the same IP address. |

### Attack 2: SQL Injection
| Item | Result |
| :--- | :--- |
| **Date** | December 3, 2025 |
| **Target** | https://pizza-service.jwtpizza329.click |
| **Classification** | Injection (OWASP A03:2021) |
| **Severity** | **Critical** |
| **Description** | I attempted to update a user profile name with the payload `<script>alert('Hacked')</script>`. The server responded with a **500 Internal Server Error** containing a MySQL syntax error: *"You have an error in your SQL syntax... near 'Hacked')</script>'"*. This confirms that user input is being directly concatenated into the SQL query, exposing the database to manipulation and data exfiltration. |
| **Images** | ![SQL Injection Error](XSSError.png) |
| **Corrections** | I will update the `updateUser` function in `database.js` to use parameterized queries (prepared statements) instead of string concatenation to sanitize all inputs. |