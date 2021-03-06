const amqp = require('amqplib')
const EventEmitter = require('events')

class MQ extends EventEmitter {
    
    constructor({login,password,host}){
        super()
        this.login = login //|| 'notifications'
        this.password = password//|| '8rWXbKz97k8peA5j'
        this.host = host
        this.mq = undefined
        this.canal = undefined
        this.exchanges = []
    }

    async connect (){
        try {
            if (this.mq) {
                await this.disconnect()
                this.mq = undefined
            }
            const serverMQLogin = this.login?(this.password?(this.login+':'+this.password+'@') : this.login+'@') : ''
            this.mq = await amqp.connect(`amqp://${serverMQLogin}${this.host}?heartbeat=3600`,{autoDelete:true})
            this.canal = await this.mq.createChannel()
            this.emit('connected')
            this.mq.on('error',(err)=>{
                this.emit('error', err)
                this.emit('disconnected')     
            })
        } catch (err) {
            throw err
        }
    }

    async disconnect(){
        try {
            this.mq.close()
            await this.unsubscribe()
            this.mq = undefined
        } catch (err) {   
        }finally{
            this.emit('disconnected')
        }
    }

    async subscribe({exchangeName,topic}){
        try {
            let  q, KTopic
            let KExchange = this.exchanges.findIndex((ex)=>ex.name==exchangeName)
            if (KExchange > -1){
                //on recuepre le topic
                KTopic = this.exchanges[KExchange].topics.findIndex((t)=>t.name==topic)
                if (KTopic > -1){
                    q = this.exchanges[KExchange].topics[KTopic].q
                } else {
                    q = await this.canal.assertQueue(null,{exclusive:true})
                    this.exchanges[KExchange].topics.push({
                        name: topic,
                        q
                    })
                }
            }else{
                await this.canal.assertExchange(exchangeName, 'topic', {durable: false})
                q = await this.canal.assertQueue(null,{exclusive:true})
                this.exchanges.push({
                    name: exchangeName,
                    topics:[{
                        name: topic,
                        q
                    }]
                })
                KExchange = this.exchanges.length - 1
            }

            this.canal.bindQueue(q.queue, exchangeName, topic);
            this.exchanges[KExchange].consumer = await this.canal.consume(q.queue,(msg) => {
                try {
                    if (msg && msg.content) {
                        msg.content=msg.content.toString()
                        msg.content=JSON.parse(msg.content)
                        this.emit('message', {topic,...msg.content})
                    }
                } catch(err) {
                    this.emit('message', {
                        topic,
                        title: 'Il y a une erreur sur les notifications' ,
                        message: err.message,
                        icon: 'error'})
                }
            },{
                noAck: true
            })
        } catch (err) {
            throw err
        }
        
    }

    unsubscribe(args = {}){
        try {
            exchangeName = args.exchangeName
            topic = args.topic

            if (exchangeName){
                //on ferme le topic
                let KExchange = this.exchanges.findIndex((ex)=>ex.name==exchangeName)
                if (topic) {
                    let KTopic = this.exchanges[KExchange].topics.findIndex((t)=>t.name==topic)
                    this.canal.deleteQueue(this.exchanges[KExchange].topics[KTopic].q.queue).catch((err)=>{})
                    this.exchanges[KExchange].topics.splice(KTopic,1)
                } else{
                    //on ferme tout les topics de l exchange
                    for (const [KTopic,topic] of this.exchanges[KExchange].topics){
                        this.canal.deleteQueue(topic.q.queue/*,true*/)
                        this.exchanges[KExchange].topics.splice(KTopic,1)
                    }                   
                }
            } else {
                //on ferme tout les topics de tout les exchanges
                for (let KExchange in this.exchanges){
                    this.exchanges[KExchange].topics.forEach((topic,KTopic) => {
                        this.canal.deleteQueue(topic.q.queue/*,true*/).catch((err)=>{})
                        this.exchanges[KExchange].topics.splice(KTopic,1)
                    });
                    this.exchanges.splice(KExchange,1)
                }  
            }
        } catch (err) {
            throw err
        }
    }

    status(){
        return this.status
    }
}

module.exports = MQ
