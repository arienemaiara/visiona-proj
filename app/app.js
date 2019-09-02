const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.static(__dirname + '/public'));

app.use('/', (req, res, next)=>{
	res.render('index')
});

const port = process.env.PORT || 3000;

app.listen(port, function() {
	console.log('Running on port', port);
});

module.exports = app;