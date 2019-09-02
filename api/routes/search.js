const request = require('request');
const express = require('express');
router = express.Router();

router.post('/', (req, res, next) => {
    var data = req.body || '';
    if (data === '') next();
    else {
        var options = {
            method: 'POST',
            url: 'https://sat-api.developmentseed.org/stac/search',
            headers: {
                'cache-control': 'no-cache',
                'content-type': 'application/javascript'
            },
            body: JSON.stringify(data)
        };
        request(options, function (error, response, body) {
            if (error) res.send(error);
            else res.send(body);
        });
    }
})

module.exports = router;