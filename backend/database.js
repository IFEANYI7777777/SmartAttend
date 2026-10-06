const Database = require("better-sqlite3");

const db = new Database("smartattend.db");

// Employees table
db.prepare(`
  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    section TEXT NOT NULL,
    pin TEXT NOT NULL UNIQUE
  )
`).run();

// Attendance table
db.prepare(`
  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    clock_in_time TEXT NOT NULL,
    status TEXT NOT NULL,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
  )
`).run();

// Remove duplicate attendance records,
// keeping the first record for each employee per day
db.prepare(`
  DELETE FROM attendance
  WHERE id NOT IN (
    SELECT MIN(id)
    FROM attendance
    GROUP BY employee_id, date
  )
`).run();

// Prevent the same employee from checking in more than once per day
db.prepare(`
  CREATE UNIQUE INDEX IF NOT EXISTS unique_employee_daily_attendance
  ON attendance (employee_id, date)
`).run();

module.exports = db;