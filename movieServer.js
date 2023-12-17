const express = require("express");
const app = express();
const path = require("path");
const bodyParser = require("body-parser");
require("dotenv").config({path: path.resolve(__dirname, "credentials/.env")});

if (process.argv.length != 3) {
    process.stdout.write("Usage movieServer.js <port number>\n");
    process.exit(1);
}

const portNumber = process.argv[2];
const options = {
  method: 'GET',
  headers: {
    'X-RapidAPI-Key': '504e9fd83cmsh29b3bdb9f5c6276p1f51abjsn9d6ba89896c9',
    'X-RapidAPI-Host': 'movie-database-alternative.p.rapidapi.com'
  }
};

const userName = process.env.MONGO_DB_USERNAME;
const password = process.env.MONGO_DB_PASSWORD;

const db = process.env.MONGO_DB_NAME;
const coll = process.env.MONGO_DB_COLLECTION;

const {MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${userName}:${password}@cluster0.5vx9e5z.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {serverApi: ServerApiVersion.v1 });

app.use(bodyParser.urlencoded({extended:false}));

app.set("views", path.resolve(__dirname, "templates"));

app.set("view engine", "ejs");
app.use(express.static(__dirname + '/templates'));

app.get("/", (req, res) => {
    recentReleases().then((movies) => {
        let list = "";
        movies.forEach((movie) => {
            let link = `'https://www.imdb.com/title/${movie.id}'`
            let buttons = `
                <form action="http://localhost:${portNumber}/rate" method="post">
                    <input
                    list="ratings"
                    name="rating"
                    id="rate"
                    required
                    >
                    <datalist id="ratings">
                    <option value=""></option>
                    <option value="A"></option>
                    <option value="B"></option>
                    <option value="C"></option>
                    <option value="D"></option>
                    <option value="F"></option>
                    </datalist>
                    <input type="text" name="title" value="${movie.title}" style="display: none;">
                    <button type="submit">RATE</button>
                </form>`
            if(movie.watched) {
                buttons += `<h3 align="center" id="rating">RATING: ${movie.rating}</h3>`
            }
            list +=`<span><h3 id="title-link" align="center" onclick="window.open(${link})">${movie.title}</h3><img src="${movie.poster}">${buttons}</span>`
        })
        
        res.render('home', {list: list})
    })
});


app.get("/watched", (req,res) => {
    let title = req.body.title;
    findMovies({watched: true}).then((results) => {
        let list = ""
        results.forEach((movie) => {
            let link = `'https://www.imdb.com/title/${movie.id}'`
            let buttons = `
            <form action="http://localhost:${portNumber}/rate" method="post">
                <input
                list="ratings"
                name="rating"
                id="rate"
                required
                >
                <datalist id="ratings">
                <option value=""></option>
                <option value="A"></option>
                <option value="B"></option>
                <option value="C"></option>
                <option value="D"></option>
                <option value="F"></option>
                </datalist>
                <input type="text" name="title" value="${movie.title}" style="display: none;">
                <button type="submit">RATE</button>
            </form>`
            buttons += `<h3 align="center" id="rating">RATING: ${movie.rating}</h3>`
            list +=`<span><h3 id="title-link" align="center" onclick="window.open(${link})" >${movie.title}</h3><img class="center" src="${movie.poster}">${buttons}</span>`
        })
        res.render("watched", {list: list})
    });
})

app.get("/search", (req,res) => {
    res.render('search', {link: `http://localhost:${portNumber}/results`})
})

app.get("/redirect/:id", (req,res) => {
    res.redirect(`https://www.imdb.com/title/${req.params.id}`)
})

app.post("/rate", (req, res) => {
    let title = req.body.title;
    findMovie({title: title}, req.body.rating).then((movie) => {
        let display = `<h2> You Rated <em>${title}</em>: ${req.body.rating} </h2><img src="${movie.poster}">`
        res.render("rate", {display: display})
    })
})

app.post("/rateNew", (req, res) => {
    let newMovie = {
        title: req.body.title,
        year: req.body.year,
        type: req.body.type,
        poster: req.body.poster,
        rating: req.body.rating,
        id: req.body.id,
        watched: true,
        watchlist: false
    } 
    insertMovie(newMovie)
    let display = `<h2> You Rated <em>${newMovie.title}</em>: ${newMovie.rating} </h2><img src="${newMovie.poster}">`
    res.render("rate", {display: display})
})

app.post("/results", (req, res) => {
    let title = req.body.title;
    searchAPI(title).then((results) => {
        let list = ""
        results = JSON.parse(JSON.stringify(results.Search))
        results.forEach((movie) => {
            let link = `'https://www.imdb.com/title/${movie.imdbID}'`
            let buttons = `
            <form action="http://localhost:${portNumber}/rateNew" method="post">
                <input
                list="ratings"
                name="rating"
                id="rate"
                required
                >
                <datalist id="ratings">
                <option value=""></option>
                <option value="A"></option>
                <option value="B"></option>
                <option value="C"></option>
                <option value="D"></option>
                <option value="F"></option>
                </datalist>
                <input type="text" name="title" value="${movie.Title}" style="display: none;">
                <input type="text" name="year" value="${movie.Year}" style="display: none;">
                <input type="text" name="type" value="${movie.Type}" style="display: none;">
                <input type="text" name="poster" value="${movie.Poster}" style="display: none;">
                <input type="text" name="id" value="${movie.imdbID}" style="display: none;">
                <button type="submit">RATE</button>
            </form>`
            list +=`<span><h3 id="title-link" align="center" onclick="window.open(${link})" >${movie.Title}</h3><img class="center" src="${movie.Poster}">${buttons}</span>`
        })
        res.render("results", {list: list})
    });
})

async function insertMovie(movie) {
    console.log("CALLED!!!!")
    try {
        await client.connect();
        await client.db(db).collection(coll).insertOne(movie);
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

async function findMovies(filter) {
    let result;
    try {
        await client.connect();
        cursor = await client.db(db).collection(coll).find(filter);
        result = await cursor.toArray()
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
    return result;
}

async function findMovie(filter, rating) {
    let result;
    try {
        await client.connect();
        result = await client.db(db).collection(coll).findOne(filter);
        await client.db(db).collection(coll).updateOne(filter,{$set:{rating: rating, watched: true}});
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
    return result;
}

async function recentReleases() {
    let result;
    try {
        await client.connect();
        let cursor = await client.db(db).collection(coll).find({year: 2023});
        result = await cursor.toArray();
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
    return result;
}

async function searchAPI(name,year,type="") {
    const url = `https://movie-database-alternative.p.rapidapi.com/?s=${name}&r=json&type=${type}&y=${year}&page=1`;
    let result
    try {
        const response = await fetch(url, options);
        result = await response.json();
    } catch (error) {
        console.error(error);
    }
    return result
}

app.listen(portNumber); 
let prompt = `Web server is running at http://localhost:${portNumber}`;
prompt += "\nStop to shutdown the server: ";
process.stdout.write(prompt);
process.stdin.setEncoding("utf8");

process.stdin.on('readable', () => { 
	let dataInput = process.stdin.read();
	if (dataInput !== null) {
		let command = dataInput.trim();
		if (command.toLowerCase() === "stop") {
			console.log("Shutting down the server");
            process.exit(0); 
        } else {
			console.log(`Invalid command: ${command}`);
		}
        process.stdout.write(prompt);
        process.stdin.resume();
    }
});