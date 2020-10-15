const electron = require('electron')
const { app, BrowserWindow, Tray, Menu, ipcMain   } = electron
const path = require('path');
require('./notification')
const {config} = require('./config') || undefined
const MQ = require('./mq');
const notification = require('./notification')
//Auto update
require('update-electron-app')({
  repo: 'fatoldsun00/AMQPOSnotification.git',
  updateInterval: '5 minutes',
})

let mqServer = undefined

let mainWindow = undefined
//defaults
let width = 350;
let height = 250;

let margin_x = 0;
let margin_y = 0;

const appFolder = path.dirname(process.execPath)
const updateExe = path.resolve(appFolder, '..', 'Update.exe')
const exeName = path.basename(process.execPath)

//lancement au démarrage
app.setLoginItemSettings({
  openAtLogin: true,
  path: updateExe,
  args: [
    '--processStart', `"${exeName}"`,
    '--process-start-args', `"--hidden"`
  ]
})


function createWindow () {
  app.allowRendererProcessReuse = true
  // Cree la fenetre du navigateur.
  mainWindow = new BrowserWindow({
    //width,
   // height,
    useContentSize: true,
    icon: path.join(__dirname,'assets', 'iconeCo.ico'),
    webPreferences: {
      nodeIntegration: true
    },
    //mainWindow.setAlwaysOnTop(true, 'screen')
    //frame: false,
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

  
  //mainWindow.hide()
  //showWindow()
  //Envoie de la config
  mainWindow.webContents.once('dom-ready', async () => {
    const conf = config.get()
    if (!conf) mainWindow.show()
    mainWindow.setSkipTaskbar(false)
    mainWindow.webContents.send('config', JSON.stringify(conf))
    await connectServer({server: conf.server,login: conf.login,password: conf.password})
    //if (conf.exchanges && conf.exchanges.length > 0 ) recoTopicAuto(conf)
    //mainWindow.webContents.send('config', JSON.stringify(conf))
  });

  // et charger le fichier index.html de l'application.
  mainWindow.loadFile('index.html')
  mainWindow.webContents.openDevTools()
  
  /*Vuejs devtools*/
  const os = require('os')
  BrowserWindow.addDevToolsExtension(
     path.join(os.homedir(), 'AppData\\Local\\Chromium\\User Data\\Default\\Extensions\\nhdogjmejiglipccpnnnanhbledajbpd\\5.3.3_0')
  )
}

app.setLoginItemSettings({
  openAtLogin: true
})

// Cette méthode sera appelée quant Electron aura fini
// de s'initialiser et prêt à créer des fenêtres de navigation.
// Certaines APIs peuvent être utilisées uniquement quand cet événement est émit.
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

//IPCMain


// appelle async qui renvoie une promise
ipcMain.handle('connectServer', (event, {server, login, password}) => {
  connectServer({server, login, password})
})

const connectServer = async ({server, login, password}) => {
  try {
  //co
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
      //mainWindow.webContents.send('config', JSON.stringify(config.get()))
      //mainWindow.webContents.send('error', err.message)
      //mainWindow.webContents.send('error', err.message)
      //reco auto dans 10 s
      //await connectMQ()
      //await mqServer.connect()
      err=JSON.parse(err)
      if (err.code == "ECONNRESET"){
        mainWindow.webContents.send('error', err.message)
        await connectMQ()
      } 
      console.log(err);
      //await connectMQ()
    })
    await connectMQ()
  } catch (err) {
    //mainWindow.webContents.send('error', err.message)
  throw err
  }

}
const connectMQ = (() => {

  //let recoInProgress = false
  let pointerWait = undefined
  //let cancelPreviousReco = false

  return async () => {
    //if(waitForReco) cancelPreviousReco = true
    try {
//      recoInProgress = true
      clearInterval(pointerWait)
      await mqServer.connect()
      
    } catch (err) {
      recoInProgress = false
      mainWindow.webContents.send('error', err.message)
      await new Promise(resolve =>  pointerWait=setTimeout(async ()=>{
        //await mqServer.disconnect()
        await connectMQ()
       
        return resolve
      } , 4000))
     
    } finally {
      let conf = config.get()
      recoTopicAuto(conf)
      mainWindow.webContents.send('config', JSON.stringify(conf))
      mainWindow.webContents.send('error', '')
    }
  }
  //if (cancelAutoReco) console.log('exist')
  //if (!cancelAutoReco) console.log('exist pas')
  //let cancelAutoReco = true
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
      showWindow()
    }
  })
})


//Gestion de la position de la fenetre popup
function showWindow() {
  //alignWindow();
  mainWindow.show(); 
}


function alignWindow() {
  const position = calculateWindowPosition();

  width = electron.screen.getPrimaryDisplay().size.width/2 //350;
  height = electron.screen.getPrimaryDisplay().size.height //250;


  mainWindow.setBounds({
    width: width,
    height: height,
    x: position.x,
    y: position.y
  });
}

function calculateWindowPosition() {
  const screenBounds = electron.screen.getPrimaryDisplay().size;
  const trayBounds = tray.getBounds();

  //where is the icon on the screen?
  let trayPos = 4; // 1:top-left 2:top-right 3:bottom-left 4.bottom-right
  trayPos = trayBounds.y > screenBounds.height / 2 ? trayPos : trayPos / 2;
  trayPos = trayBounds.x > screenBounds.width / 2 ? trayPos : trayPos - 1;

  let DEFAULT_MARGIN = { x: margin_x, y: margin_y };

  //calculate the new window position
  switch (trayPos) {
    case 1: // for TOP - LEFT
      x = Math.floor(trayBounds.x + DEFAULT_MARGIN.x + trayBounds.width / 2);
      y = Math.floor(trayBounds.y + DEFAULT_MARGIN.y + trayBounds.height / 2);
      break;

    case 2: // for TOP - RIGHT
      x = Math.floor(
        trayBounds.x - width - DEFAULT_MARGIN.x + trayBounds.width / 2
      );
      y = Math.floor(trayBounds.y + DEFAULT_MARGIN.y + trayBounds.height / 2);
      break;

    case 3: // for BOTTOM - LEFT
      x = Math.floor(trayBounds.x + DEFAULT_MARGIN.x + trayBounds.width / 2);
      y = Math.floor(
        trayBounds.y - height - DEFAULT_MARGIN.y + trayBounds.height / 2
      );
      break;

    case 4: // for BOTTOM - RIGHT
      x = Math.floor(
        trayBounds.x - width - DEFAULT_MARGIN.x + trayBounds.width / 2
      );
      y = Math.floor(
        trayBounds.y - height - DEFAULT_MARGIN.y + trayBounds.height / 2
      );
      break;
  }
  x=0
  y=0
  return { x: x, y: y };
}
