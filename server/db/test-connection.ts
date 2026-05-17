import { db } from '../src/db.ts'

db.query('SELECT NOW() as now, current_database() as db')
  .then(res => { console.log('Connected:', res.rows[0]); db.end() })
  .catch(err => { console.error('Connection failed:', err.message); process.exit(1) })
