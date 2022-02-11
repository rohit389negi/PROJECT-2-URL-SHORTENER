const urlModel = require('../models/urlModel')
const shortUniqueId = require('short-unique-id')
const isUrlValid = require('url-validation')
const redis = require('redis')
const { promisify } = require("util")

// Connecting to redis -----------------------------------------------------------
const redisClient = redis.createClient(
    19634,
    "redis-19634.c264.ap-south-1-1.ec2.cloud.redislabs.com", { no_ready_check: true }
);
redisClient.auth("PfAd331Moph13mEzK4AjK2laBpjMn6Vx", function (err) {
    if (err) throw err;
});
redisClient.on("connect", async function () {
    console.log("Connected to Redis..Let's GO");
});

//Connection setup for redis
const SET_ASYNC = promisify(redisClient.SET).bind(redisClient);
const GET_ASYNC = promisify(redisClient.GET).bind(redisClient);

const isValid = function (value) {
    if (typeof value == 'undefined' || value == null) return false
    if (typeof value == 'string' && value.trim().length == 0) return false
    return true
}
const isValidReqBody = function (value) {
    return Object.keys(value).length > 0
}
const urlShortener = async function (req, res) {
    try {
        const requestBody = req.body
        if (!isValidReqBody(requestBody)) {
            res.status(400).send({ status: false, message: 'Invalid request parameters. Please provide url details' })
            return
        }
        const { longUrl } = requestBody
        if (!isValid(longUrl)) {
            res.status(400).send({ status: false, message: "longUrl is required" })
            return
        }
        if (!isUrlValid(longUrl.trim())) {
            res.status(400).send({ status: false, message: "longUrl is not valid, Please provide valid url" })
            return
        }
        const isShortUrlAlreadyAvailable = await urlModel.findOne({ longUrl })
        if (isShortUrlAlreadyAvailable) {
            const { longUrl, shortUrl, urlCode } = isShortUrlAlreadyAvailable
            const urlDetails = { longUrl, shortUrl, urlCode }            
            await SET_ASYNC(`${longUrl}`, JSON.stringify(urlDetails))   
            return res.status(200).send({ satus: true, data: urlDetails })
        }
        
        const uid = new shortUniqueId({ length: 5 });
        uid.setDictionary('alpha_lower');
        const urlCode = uid();
        const shortUrl = "http://localhost:3000/" + urlCode
        const urlDetails = { longUrl, shortUrl, urlCode }
        const newUrl = await urlModel.create(urlDetails)
        await SET_ASYNC(`${longUrl}`, JSON.stringify(urlDetails))
        return res.status(200).send({ satus: true, data: newUrl })
    } 
    catch (err) {
        return res.status(500).send({ status: false, message: err.message })
    }
}

const getUrl = async function (req, res) {
    try {
        urlCode = req.params.urlCode
        let cachedUrlData = await GET_ASYNC(`${urlCode}`)
        if (cachedUrlData) {
            const longUrl = JSON.parse(cachedUrlData)
            res.status(302).redirect(longUrl)
            return
        }
        const urlDetails = await urlModel.findOne({ urlCode })
        if (!urlDetails) {
            res.status(400).send({ status: false, message: `Page not found` })
            return
        }
        const longUrl = urlDetails.longUrl
        await SET_ASYNC(`${urlCode}`, JSON.stringify(longUrl))
        res.status(302).redirect(longUrl)
        return
    } catch (err) {
        return res.status(500).send({ status: false, message: err.message })
    }
}

module.exports = { urlShortener, getUrl }
