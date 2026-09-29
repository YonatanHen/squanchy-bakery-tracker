- Architecture: 
1. PostgreSQL - the data is structured.
2. UI: React so it would be easy to run and test without installing heavy dependencies like Expo but in production: React Native - she said she wants to check the data from her phone. A cross-platform mobile application would be the best for this purpose.
3. Backend: Python - Flask + SQLAlchemy as an ORM.
4. AI assisted tool - Claude Code.
5. LLM provider - Ollama/Gemini flash.
6. Tests: unit test with Pytest, E2E with Playwright.
7. Validation: Pydantic.

- Architecture decisions:
1. Temp is inconsistent in the Haifa branch probably becuase it is recorded in Farenheit, where other fridges record in Celcius. We would add this as an ENUM (C,F).
2. We can infer that there are multiple branches in the same city, therefore, created a Branch table in the DB including all details about the branch - city, address, etc. According to the current data we have 1 branch in each city so each branch is named by the city branch. However, if the company would decide to add a new branch in Tel Aviv Azrieli mall next month, we can name it as "Tel-Aviv Azrieli" with accurate address and keep the 1st Tel Aviv branch as "Tel Aviv" with its data. 
3. Date format is unique in ISO 8601, all dates are written in another format in the past would be converted in runtime.
4. Fridge state would be recorded as well, as an enum with ERR and OK statuses.
5. AI integration - on every addition, we would ask an AI system to check the data and find any unusual behavior like the issue with the Rishon Leziyon branch. If issue has found, we would show an alert in the app that asks the user to check this. she sayed: "from branch to branch, the columns move around. Sometimes there’s agap of a couple of hours in a file and I never know if the logger died, the battery ran out, or it just didn’t save. And someone opens the door for adelivery and you see a jump for one reading, which is fine. A fridge that’sslowly warming up is not fine." - for now we can infer that we have only the temperature sensor in the Fridges, not a open/closed and battery sensors so I decided not to add these values as metrics but warning up the user if any suspicious issue should be investigated in the fridge. 
The kind of alerts I want to add:
a. We would save the average temp per fridge and update it with every new record. if a new record shows a number that is relatively far from the fridge average, we would let the user know about it - then the user would need to decide if its a false positive raised by open fridge or an issue.
b. We would save the last time we measured fridge temperature. It can be inferred from the data that the logger measures every 15 minutes. If temperature is not measured 15 minutes after the last time we would let the user know about it with an appropriate alert.
c. LLM provider would check for constant increasing/decresaing of the temperature and alert the user about it.
6. It appears that each fridge has a logger in 1-to-1 relathionship, I would assume that every fridge has 1 logger and logger is attached to a single fridge only.
7. Explicitly mentioned that every Branch could have few Fridges, therefore 1 1-to-many relationship.
8. Alerts from section #5 would be saved in a dedicated table in the DB, so where the Ministry of Health inspector would ask her questions, she would know exactly what happened based on the logs.
9. UI core features:
a. Add records from excel sheet drop down that populates the DB and show the new records in the UI.
b. A table including all the records (fro both backend and frontend - pagination based on offset).
c. A table including all alerts.
d. all table pages allow the user to filter the data based on the params: branch name, fridge name, city/address, date, status, logger id.
10. Pagination with an offest allowed to load small amount of data each time rather than all of the 3K+ possible rows mentioned to decrease runtime.
11. In the UI - celcius to Farenheit converter for the presented offset, allow Summer to find the temeprature in the same metric instead of calculate in her head. keeping both in the DB rather than store in 1 metric as its not clearly mentioned if she needs both or only one of them.
12. We should build backend design for reading Excel files, store them temporarily in runtime and write the data in the DB. We want to help Summer with writing each and every row manually so we would build the code in a design that allows reading from multiple resources (we don't know in which format the fridges export the logs by default and if there is a difference between every fridge) then writing in the same way to the DB as follows:

```upload → ParserFactory → [ExcelParser | CsvParser | JsonParser …] → RawRow[]
       → Normalizer (units, dates, branch names, ERR) → Reading[]
       → Validator → ReadingRepository.save_many() → DB

1. Strategy: one parser per format

Every parser implements the same interface and returns the same neutral output. The rest of the system never knows which format the data came from.

class ReadingParser(Protocol):
    def can_parse(self, filename: str, head: bytes) -> bool: ...
    def parse(self, stream: BinaryIO) -> Iterable[RawRow]: ...

class ExcelParser:  # uses openpyxl
    ...
class CsvParser:
    ...

Each parser also works as an Adapter: it converts one external format into your internal RawRow model.

2. Factory / Registry: choose the parser

PARSERS: list[ReadingParser] = [ExcelParser(), CsvParser()]

def get_parser(filename: str, head: bytes) -> ReadingParser:
    for p in PARSERS:
        if p.can_parse(filename, head):
            return p
    raise UnsupportedFormat(filename)

To add a new format, you write one class and register it. Nothing else changes, so this follows the Open/Closed principle. Check the first bytes of the file (head), not only the extension. Users rename files, and an .xlsx file is really a ZIP archive.

3. Normalizer: separate from the parsers

This is the key decision. The problems in Summer's email do not depend on the file format:
- The columns move around.
- Haifa uses Fahrenheit.
- Date formats differ (14/09/2026 vs 2026-09-14).
- ERR values and duplicate rows.

All of these can happen in Excel and in CSV alike. If you put this logic inside each parser, you duplicate it for every format. Parsers should only read the file. The normalizer turns RawRow into a clean Reading, and it runs once for all formats.

4. Repository: the one way to write

class ReadingRepository:
    def save_many(self, readings: list[Reading], upload_id: int) -> SaveResult:
        # one transaction; skip duplicates via UNIQUE (logger_id, time)
        ...

- There is one write path, so the constraints, deduplication, and the upload provenance record are handled in one place.
- Use a single transaction per file. A file is saved completely or not at all.
- Return a result such as "1,203 inserted, 14 duplicates skipped, 3 ERR rows". This is useful feedback for the user after the upload.```

13. Let the user add a single record manually according to the values format (date, names, etc.)
14. CRUD operations I want to support are: 
GET all records (with pagination)
POST add new records based on payload (file/content).
DELETE record from the DB
PATCH update one of the records
15. Add a login page with Summer credentials (could be simple like: 'admin', 'password'), once connected provide her with a JWT token for the session that would server her throughout the usage of the application by sending REST API requests with a valid JWT only.


Would be developed if it was a real production system, currenly out of scope:
1. Deployemnt to real server, allowing Summer to connect from anywhere.
2. Authorization & Authentication: once deployed to the network, we should guarantee that only allowed users could be able to login and signup. Additionally, we should allow specific permissions to each user type - Summer is an admin that can read all data/delete/add/update it, but maybe a branch manager wants to check data and alerts of his branch in the same app so we would give him a reader permissions to his branch only. In this app we would add only the admin user for Summer.
3. Payed LLM Provider API Key for better performance and results.
4. React Native application as the UI.
5. CI/CD flow including lint, build, test, deployment, etc.