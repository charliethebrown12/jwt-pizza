# Penetration Test Report

## Self Attack
**Peer Name:** Charles Butler

### Attack 1: SQL Injection
| Item | Result |
| :--- | :--- |
| **Date** | December 3, 2025 |
| **Target** | https://pizza-service.jwtpizza329.click |
| **Classification** | Injection (OWASP A03:2021) |
| **Severity** | **Critical** |
| **Description** | I attempted to update a user profile name with the payload `<script>alert('Hacked')</script>`. The server responded with a **500 Internal Server Error** containing a MySQL syntax error: *"You have an error in your SQL syntax... near 'Hacked')</script>'"*. This confirms that user input is being directly concatenated into the SQL query, exposing the database to manipulation and data exfiltration. |
| **Images** | ![SQL Injection Error](XSSError.png) |
| **Corrections** | I will update the `updateUser` function in `database.js` to use parameterized queries (prepared statements) instead of string concatenation to sanitize all inputs. |


## Peer Attack
**Peer Name:** Amur Bashirov
**URL:** https://pizza.eatandtravel.click

### Attack 1: SQL Injection
| Item | Result |
| :--- | :--- |
| **Date** | December 8, 2025 |
| **Target** | https://pizza.eatandtravel.click |
| **Classification** | Injection (OWASP A03:2021) |
| **Severity** | **Critical** |
| **Description** | I executed a SQL injection attack against the user profile endpoint (`PUT /api/user/37`). By injecting the payload `<script>alert(\"Hacked\")</script>` into the name field, I triggered a server crash. The browser console and network tab confirmed a **500 Internal Server Error** with the message *"You have an error in your SQL syntax; check the manual... near 'Hacked\")</script>' WHER' at line 1"*. This confirms the application is susceptible to SQL injection via unsanitized string concatenation. |
| **Images** | ![Peer SQL Injection](Amur%20website%20SQL%20Injection.png) |
| **Corrections** | The peer must update their database access layer to use parameterized queries (e.g., using `?` placeholders) instead of concatenating user input directly into SQL strings. |