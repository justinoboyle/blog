"use strict";
const express = require('express'),
    pg = require('pg');

const app = express();

const dbURL = process.env.DATABASE_URL || require('./config.json').database_url;

const staticDirBase = __dirname + '/public';

const port = process.env.PORT || 3000;

const websitePrefix = "http://localhost:3000"

const showdown = require('showdown'),
    converter = new showdown.Converter();

String.prototype.trunc =
    function (n, useWordBoundary) {
        var isTooLong = this.length > n,
            s_ = isTooLong ? this.substr(0, n - 1) : this;
        s_ = (useWordBoundary && isTooLong) ? s_.substr(0, s_.lastIndexOf(' ')) : s_;
        return isTooLong ? s_ + '&hellip;' : s_;
    };

app.set('view engine', 'ejs');
app.use('/static', express.static(staticDirBase));

app.use(require('express-minify-html')({
    override: true,
    htmlMinifier: {
        removeComments: true,
        collapseWhitespace: true,
        collapseBooleanAttributes: true,
        removeAttributeQuotes: true,
        removeEmptyAttributes: true,
        minifyJS: true
    }
}));

pg.defaults.ssl = true;

GLOBAL.dbClient = new pg.Client(dbURL);

dbClient.connect((err) => {
    if (err)
        return console.log(err);
    dbClient.query("CREATE TABLE IF NOT EXISTS POSTS(id TEXT, title TEXT, content TEXT, categories TEXT, timestamp TEXT);");
});

app.listen(port, () => {
    console.log("Listening on port " + port);
});

app.get('/post/:post', (req, res) => {
    let post = req.params.post;
    dbClient.query("SELECT id,title,content,categories,timestamp FROM POSTS WHERE id=$1", [post], (err, dbRes) => {
        if (err)
            return res.send("Oops, an error occured.");
        if (dbRes.rows.length <= 0)
            return res.send("oops, an error occured.");
        let post = dbRes.rows[0];
        post.content = converter.makeHtml(post.content);
        res.render(__dirname + '/pages/post', { post: post });
    });
});

app.get('/:page*?', (req, res) => {
    let limit = 10;
    let page = parseInt(req.params.page) || 1;
    let offset = (page - 1) * limit;
    console.log(offset);
    dbClient.query("SELECT id,title,content,categories,timestamp FROM POSTS ORDER BY TIMESTAMP DESC OFFSET($1) LIMIT($2)", [offset, limit], (err, dbRes) => {
        if (err)
            return res.send("Oops, an error occured.");
        let temp = dbRes.rows;
        for (let x of temp)
            x.content = converter.makeHtml(x.content.trunc(120 * 10, true));
        res.render(__dirname + '/pages/index', { posts: dbRes.rows, nextPage: page + 1 });
    });
});

app.get('/sitemap.xml', (req, res) => {
    dbClient.query("SELECT id FROM POSTS ORDER BY TIMESTAMP DESC", [offset, limit], (err, dbRes) => {
        let build = [];
        for (let row of dbRes.rows)
            build.push('  <url><loc>' + websitePrefix + '/post/' + row.id + '</url></loc>');
        return res.send([
            "<?xml version='1.0' encoding='UTF-8'?>",
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
            build.join('\n'),
            '</urlset>'
        ]).join('\n');
    });
})