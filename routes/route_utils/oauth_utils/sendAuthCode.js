// input -  req.body contains transaction_id , descison
// output - code(expiresin:10minutes) , state from transaction
const User = require('../../../src/config/models/user.model')
const Transaction = require('../../../src/config/models/transaction.model')
const Authorization = require('../../../src/config/models/authcodes.model')
const Client = require('../../../src/config/models/client.model')
const jwt = require('jsonwebtoken')

function sendAuthCode(req, res, next) {
    const {
        transaction_id,
        decision
    } = req.body.query
    if(transaction_id === undefined && decision === undefined){
        res.json({error:'parameters_missing',status:422})
    }else if (decision === "allow") {
        Transaction.findOneAndDelete({
           _id:transaction_id
        }, (err, document) => {
            if (err) {
                res.json({
                    status:200,
                    error: 'server_error',
                    error_description: 'error encountered at server',
                    error_uri: process.env.ERROR_URI
                })
            }else if(document){
                const {
                    client_id,
                    redirect_uri,
                    state
                } = document.toObject()
                
                //const newDateobj = new Date(new Date().getTime() + 50000)
                //expired after five minutes
                let promise1 =  User.findOne({
                    _id: req.user._id
                },{approved_clients:1}).exec()
                //creating an auth code
                let promise2 = Authorization.create({
                    client_id,
                    user_id: req.user._id,
                    redirect_uri,
                    used: false
                })
                
                Promise.all([promise1,promise2])
                .then(resarr=>{
                    const doc = resarr[1]
                     jwt.sign({
                            id: doc._id
                        }, process.env.AUTH_SECRET, {
                            expiresIn: 300 //token expired in 5 minutes
                        }, (err, token) => {
                            if (err) {
                                res.json({
                                    status:500,
                                    error: 'server_error',
                                    error_description: 'error encountered at server',
                                    error_uri: process.env.ERROR_URI
                                })
                            } else {
                                res.json({
                                    status:200,
                                    code: token,
                                    state,
                                    redirect_uri
                                })
                            }
                        })
                    var check = resarr[0].toObject().approved_clients.every(ele=>{
                                    if(ele.client_id !== client_id){
                                        return true
                                    }else{
                                        return false
                                    }
                                })
                    
                    if(check){
                                User.findOneAndUpdate({_id:req.user._id},{
                                        '$push':{
                                            'approved_clients':{
                                                client_id,
                                            }
                                        }
                                    },{strict:false},(err,doc)=>{
                                        if(err){
                                            console.log('error')
                                        }
                                    })
                        
                    }
                }).catch(err=>{
                    res.json({status:500,error:'server_error',
                            error_description: 'error encountered at server',
                            error_uri: process.env.ERROR_URI})
                }) 
            }else{
                res.json({status:422,error:'transaction expired'})
            }
        })
    } else {
        Transaction.findOneAndDelete({
            _id:transaction_id
        }, (err,doc) => {
            if (err) {
                res.json({
                    status:500,
                    error: 'server_error',
                    error_description: 'error encountered at server',
                    error_uri: process.env.ERROR_URI
                })
            } else if(doc) {
                res.json({
                    status:401,
                    error: 'access_denied',
                    error_description: 'user denied the request',
                    error_uri: process.env.ERROR_URI
                })
            } else{
                res.json({
                    status:422,
                    error:'transaction doesnot exists'
                })
            }
        })

    }

}
module.exports = sendAuthCode