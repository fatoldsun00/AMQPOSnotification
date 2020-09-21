const WebSocket = require('ws')
var events = require('events')
var eventEmitter = new events.EventEmitter()
let {config} = require('./config')

const wsCo = (() => {
    let ws = undefined
    let heartbeartID 
    let WSisAlive = false
    let callBackFn = []
    let refreshCB = false
    
    const heartbeart = ()=>{
        heartbeartID = setInterval(async() => {
            try {
                if (WSisAlive == false && ws){
                    ws.terminate()
                } 
                if(WSisAlive == false){
                    await start()
                    return 
                }
                WSisAlive = false
           
                ws.ping(()=>{})
            } catch (err) {
                
            }
        }, 3000);
    }

    const refreshOnEventCB = ()=>{
        refreshOnEventCBID = setInterval(async()=>{
            if(refreshCB){
                try {
                    await restart()
                    refreshCB = false
                } catch (err) {}
            }
        },3000)
    }
    refreshOnEventCB()

    const restart = async ()=>{
        stop()
        await start()
    }
    const start = async () =>{
        try { 
            if (ws!= undefined) stop()
            let {name,server} = config.get()

            await new Promise((resolve,reject)=>{
                try {
                    ws = new WebSocket(server);
                    ws.on('open',()=>{
                        //enregistrement
                        ws.send(JSON.stringify({
                            username:name,
                            type:"hello"
                        }))
                        resolve()
                    })
                    ws.on('error',(err)=>{
                        reject(err)
                    })

                    WSisAlive =true

                    for (fn of callBackFn){
                        (() => {
                            let event = fn .event
                            let cb = fn .cb
                            ws.on(event, data => {
                                try {
                                    cb(data) 
                                } catch (err) {
                                    throw err
                                }
                        
                            })
                        })()
                    }
                } catch (err) {
                    reject(err)
                }
                
            })

            ws.on('pong', () => {
                eventEmitter.emit('status',1);
                WSisAlive=true
            });
            refreshOnEventCB()
        } catch(err) { } finally{
            heartbeart()
        }
    }
    
    const stop = ()=>{
        //retire les CB sur event
        
        try {
            for (fn of callBackFn){
                (() => {
                    let event = fn .event
                    let cb = fn .cb
                    ws.removeEventListener(fn.event, fn.cb)
                })() 
            }
        } catch (err) {
            
        }
        

        if (ws) ws.terminate()
        ws = undefined
        clearInterval(heartbeartID)
        clearInterval(refreshOnEventCBID)
        // Fire the status
        eventEmitter.emit('status',0);
    }
    
    const sendMessage = () => {} 
    
    const on = function(event,cb) {
        callBackFn.push({event,cb})
        refreshCB=true
    }

    const status = ()=> WSisAlive
   
    return {
        start,
        stop,
        restart,
        sendMessage,
        on,
        status
    }
})()

module.exports = wsCo