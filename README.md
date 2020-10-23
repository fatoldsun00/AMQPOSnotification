# AMQPOSnotification
Electron App for Os native notification throught AMQP broker (rabbitMQ, etc.)

Configure application (serveur, login and password if needed, Exchanges and topics to listen), publish a message on rabbitMQ, voilà.
Application co an AMQP broker (like rabbitMQ serveur). If server down, application try to reco server every minutes.

- You can create multiple Exchange and multiple Topic for each Exchange
- Reco auto to broker if connection down

# Notifications format
Notification must be a valid JSON, all fields are optionnal

```
{   
    title: String
    message: String
    icon: String (value must be one of follow : 'default', 'delete', 'download', 'error' )
    sound: Boolean
    wait: Boolean
    reply: Boolean (Not implemented)
    actions: Array (Button attach to notif but note implemented)
    topic : String (appID, display on top of notif)
}
```

# Want to update app ?

PR are welcome

Some upgrade :

- All message are in french, update code for manage differents languages
- Setting the retry frequence when connection fail


