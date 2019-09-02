const error = require('./middleware/error');
const express = require('express');
const cors = require('cors');
const app = express();
const search = require('./routes/search')

app.use(cors()); // habilita cors para todas as rotas
app.use(express.json()); // req.body em formato json
app.use(express.urlencoded({ extended: true })); // req.body em formato url enconded
app.use('/api/search', search); 

// error handling
app.use(error);

// definição da porta que será utilizada pela api, armazenada em variável de ambiente
const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Listening on port ${port}`));