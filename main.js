const electron = require('electron')
const { app, BrowserWindow, Tray, Menu, ipcMain   } = electron
const path = require('path');
const {config} = require('./config') || undefined
const MQ = require('./mq');
const notification = require('./notification')

//Auto Update check
const {autoUpdater} = require("electron-updater")

app.on('ready', function()  {
  autoUpdater.checkForUpdatesAndNotify();
});

let mqServer = undefined
let mainWindow = undefined
//defaults
const width = 400;
const height = 600;
let screenBounds
let x
let y

function createWindow () {

  app.allowRendererProcessReuse = true
  // Cree la fenetre du navigateur.
  screenBounds = electron.screen.getPrimaryDisplay().size
  x = screenBounds.width - width
  y = screenBounds.height - height

  mainWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    resizable: false,
    useContentSize: true,
    movable: false,
    icon: path.join(__dirname,'assets', 'iconeCo.ico'),
    webPreferences: {
      nodeIntegration: true
    },
    thickFrame: true,
    skipTaskbar: true
  })

  mainWindow.on('minimize',function(event){
    event.preventDefault();
    mainWindow.hide();
  });

  mainWindow.on('close', function (event) {
    if(!app.isQuiting){
        event.preventDefault();
        mainWindow.hide();
    }

    return false;
  });

  //Envoie de la config
  mainWindow.webContents.once('dom-ready', async () => {
    const conf = config.get()
    if (!conf) mainWindow.show()
    mainWindow.setSkipTaskbar(false)
    mainWindow.webContents.send('config', JSON.stringify(conf))
    await connectServer({server: conf.server,login: conf.login,password: conf.password})
  });

  // et charger le fichier index.html de l'application.
  mainWindow.loadFile('index.html')

  if (!app.isPackaged){ // return true if app is packaged (prod mode)
    mainWindow.webContents.openDevTools()
    /*Vuejs devtools*/
    /*const os = require('os')
    BrowserWindow.addDevToolsExtension(
       path.join(os.homedir(), 'AppData\\Local\\Chromium\\User Data\\Default\\Extensions\\nhdogjmejiglipccpnnnanhbledajbpd\\5.3.3_0')
    )*/
  } else {
    app.setLoginItemSettings({
      openAtLogin: true
    })
    
  }
}

app.whenReady().then(createWindow)

app.on('quit', () => {
  mqServer.disconnect()
})

// Quitter si toutes les fenêtres ont été fermées.
app.on('window-all-closed', () => {
  // Sur macOS, il est commun pour une application et leur barre de menu
  // de rester active tant que l'utilisateur ne quitte pas explicitement avec Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // Sur macOS, il est commun de re-créer une fenêtre de l'application quand
  // l'icône du dock est cliquée et qu'il n'y a pas d'autres fenêtres d'ouvertes.
  if (mainWindow === null) {
    createWindow()
  } 
})

// appelle async qui renvoie une promise
ipcMain.handle('connectServer', (event, {server, login, password}) => {
  connectServer({server, login, password})
})

const connectServer = async ({server, login, password}) => {
  try {
    if (mqServer) {
      mqServer.disconnect()
      mqServer = undefined
    }
    
    mqServer = new MQ({host: server, login, password})
    
    mqServer.on('message',(msg)=>{notification(msg)})
    mqServer.on('disconnected',()=>{
      tray.setImage(path.join(__dirname,'assets', iconNameUnCo))
      mainWindow.webContents.send('disconnected')
    })
    mqServer.on('connected',()=>{
      tray.setImage(path.join(__dirname,'assets', iconNameCo))
      mainWindow.webContents.send('connected')
    })

    mqServer.on('error', async(err)=>{      
      if (err.code == "ECONNRESET"){
        mainWindow.webContents.send('error', err.message)
        await connectMQ()
      } 
    })
  } catch (err) {
    mainWindow.webContents.send('error', err.message)
  }finally{
    await connectMQ()
  }
}

const connectMQ = (() => {
   let pointerWait = undefined

  return async () => {
    try {
      clearInterval(pointerWait)
      await mqServer.connect()
      let conf = config.get()
      recoTopicAuto(conf)
      mainWindow.webContents.send('config', JSON.stringify(conf))
      mainWindow.webContents.send('error', '')

    } catch (err) {
      mainWindow.webContents.send('error', err.message)
      pointerWait=setTimeout(async ()=>{
        connectMQ()
      } , 60000)
    }
  }
})()

const recoTopicAuto = async (config) =>{
  if (config.exchanges){
    for (exchange of config.exchanges){
      for (topic of exchange.topics){
        if (topic.actif) {
          await mqServer.subscribe({
            exchangeName: exchange.name,
            topic: topic.name})
        }
      }
    }
  }
}


ipcMain.handle('subscribeTopic', async (event, arg) => {
  await mqServer.subscribe({exchangeName, topic} = JSON.parse(arg))
})

ipcMain.handle('unsubscribeTopic', async (event, arg) => {
  await mqServer.unsubscribe({exchangeName, topic} = JSON.parse(arg))
})

ipcMain.on('saveConfig', (event, arg) => {
  config.save(arg)
})

//systray
let tray = null
const iconNameCo = 'iconeCo.ico'
const iconNameUnCo = 'iconeUnCo.ico'
app.on('ready', () => {
  const iconPath = path.join(__dirname,'assets', iconNameUnCo)
  tray = new Tray(iconPath)
  tray.setToolTip('Notif WS')
  const contextMenu = Menu.buildFromTemplate([{
    label: 'Quit',
    click:  function(){
      app.isQuiting = true;
      app.quit();
    }
  }])
  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    if (mainWindow.isVisible()){
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  })
})

