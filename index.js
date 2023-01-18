const express = require('express');
const multer = require('multer');
const sqlite3 = require('sqlite3');
const path = require('path');
const fs = require('fs');
const { v4: uuid } = require('uuid');

const app = express();
app.use(require('body-parser').json());
const upload = multer({ dest: 'uploads/' });
const db = new sqlite3.Database('files.db');

// create table to store file information
db.run(`
    CREATE TABLE IF NOT EXISTS 
    files(
        id TEXT PRIMARY KEY, 
        name TEXT, 
        path TEXT, 
        original_name TEXT,
        original_path TEXT,
        size INTEGER, 
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

// endpoint for uploading a file
app.post('/upload', upload.single('file'), (req, res) => {
    const file = req.file;
    const id = uuid();
    const path = req.body.path || '/';
    const name = req.body.name || file.originalname;

    // insert file information into database
    db.run(`
        INSERT INTO 
        files(id, name, path, size, original_name, original_path) 
        VALUES(?, ?, ?, ?, ?, ?)`,
        [id, name, path, file.size, file.originalname, file.path],
        (err) => {
            if (err) {
                res.status(500).json({ error: 'Failed to upload file' });
            } else {
                res.json({ id, name, path, size: file.size });
            }
        });
});

// endpoint for deleting a file
app.delete('/files/:id', (req, res) => {
    const id = req.params.id;

    // delete file from database
    db.get(`SELECT * FROM files WHERE id = ?`, [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: 'Failed to get file' });
        } else if (!row) {
            res.status(404).json({ error: 'File not found' });
        } else {
            db.run(`DELETE FROM files WHERE id = ?`, [id], (err) => {
                if (err) {
                    res.status(500).json({ error: 'Failed to delete file' });
                } else {
                    // delete file from server
                    fs.unlink(row.original_path, (err) => {
                        if (err) {
                            res.status(500).json({ error: 'Failed to delete file' });
                        } else {
                            res.json({ message: 'File deleted successfully' });
                        }
                    });
                }
            });
        }
    });
});

// endpoint for getting all files
app.get('/files', (req, res) => {
    // select all files from database
    db.all(`SELECT * FROM files`, (err, rows) => {
        if (err) {
            res.status(500).json({ error: 'Failed to get files' });
        } else {
            res.json(rows);
        }
    });
});

// endpoint for getting a file by id
app.get('/file/:id', (req, res) => {
    const id = req.params.id;
    // select file from database
    db.get(`SELECT * FROM files WHERE id = ?`, [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: 'Failed to get file' });
        } else if (!row) {
            res.status(404).json({ error: 'File not found' });
        } else {
            res.status(200).download(row.original_path);
        }
    });
});

// endpoint for moving a file from one folder to another
app.patch('/files/:id/move', (req, res) => {
    const id = req.params.id;
    const path = req.body.path;

    // update file's path in database
    db.run(`UPDATE files SET path = ? WHERE id = ?`, [path, id], (err) => {
        if (err) {
            res.status(500).json({ error: 'Failed to move file' });
        } else {
            res.json({ message: 'File moved successfully' });
        }
    });
});

app.listen(3000, () => {
    console.log('Server started on port 3000');
});

// close database connection when app closes
process.on('SIGINT', () => {
    db.close();
});

module.exports = app;
