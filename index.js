import express from "express"
import http from "http"
import cors from "cors"
import { Server } from "socket.io"

const app = express()
const server = http.createServer(app)
app.use(cors())

// Cria o socket que seria o cliente
const sockets = new Server(server, {
    cors: {
        methods: ["GET", "POST"]
    }
})

const game = {
    players: {},
    rooms: {},
    match: {}
}

// Vai ser retirado posteriormente e colocado dentro das rooms, pois é lá que as validações devem ser feitas
let contador = 0

// Criar uma lista de palavras para verificar o player
const words = ['passado', 'fuga', 'segredo', 'morte']

// Aqui é onde vai ser elaborado a parte de código de enviar e receber no servidor
sockets.on('connection', (socket) => {
    console.log(`${socket.id} conectado`)

    const name = 'Player_' + socket.id.substring(0, 5)
    let color = ""
    game.players[socket.id] = { name, color }
    refreshPlayers()

    socket.on('disconnect', () => {
        delete game.players[socket.id]
        refreshPlayers()
    })

    socket.on('SendMessage', (message) => {
        sendMessage(game.players[socket.id], message)
    })

    socket.on('CreateRoom', () => {
        socket.join(socket.id)

        // Lógica com lista
        game.rooms[socket.id] = {
            name: `Sala do ${game.players[socket.id].name}`,
            player1: socket.id,
            player2: undefined,
            player3: undefined,
            player4: undefined
            // player5: undefined,
        }

        game.players[socket.id].room = socket.id

        refreshPlayers()
        refreshRooms()
        console.log(`Sala ${socket.id} criada`)
    })

    socket.on('LeaveRoom', () => {
        leaveRoom(socket)

        refreshPlayers()
        refreshRooms()
    })

    socket.on('JoinRoom', (roomId) => {
        socket.join(roomId)
        const room = game.rooms[roomId]
        let playerNumber = 'player'
        for (let i = 1; i <= 4; i++) {
            if (!room[`player${i}`]) {
                playerNumber += i;
                break;
            }
        }
        room[playerNumber] = socket.id
        game.players[socket.id].room = roomId

        if (room.player1 && room.player2 && room.player3 && room.player4) {
            game.match[roomId] = {
                player1: {
                    ready: false,
                    score: 2000,
                    color: ''
                },
                player2: {
                    ready: false,
                    score: 2000,
                    color: ''
                },
                player3: {
                    ready: false,
                    score: 2000,
                    color: ''
                },
                player4: {
                    ready: false,
                    score: 2000,
                    color: ''
                },
                time: 1200
            }
            console.log("O jogo vai começar")
            gameInProgress(true)
        }

        console.log(`${game.players[socket.id].name} entrou na sala`)
    })

    socket.on('ReadyPlayer', () => {
        contador++;
        if (contador < 4) {
            refreshReadyPlayers(contador)
        } else if (contador === 4) {
            contador = 0
            console.log("Começou o jogo")
            everyoneIsReady()
        }
    })

    // Verificação de palavra
    socket.on('VerifyWord', (obj) => {
        if (obj.color === 'Vermelho' && obj.word.toLowerCase().trim() === words[0]) {
            console.log('voce venceu, vermelho!')
            finishGame(true)
        } else if (obj.color === 'Azul' && obj.word.toLowerCase().trim() === words[1]) {
            console.log('voce venceu, azul!')
            finishGame(true)
        } else if (obj.color === 'Amarelo' && obj.word.toLowerCase().trim() === words[2]) {
            console.log('voce venceu, amarelo!')
            finishGame(true)
        } else if (obj.color === 'Verde' && obj.word.toLowerCase().trim() === words[3]) {
            console.log('voce venceu, verde!')
            finishGame(true)
        }
    })

    //E pré settar a quantidade de letras
    socket.on('SetLetters', (color) => {
        if (color === 'Vermelho') {
            sizeWord(words[0].length)
        } else if (color === 'Azul') {
            sizeWord(words[1].length)
        } else if (color === 'Amarelo') {
            sizeWord(words[2].length)
        } else if (color === 'Verde') {
            sizeWord(words[3].length)
        }
    })

})

// Essa função ira retirar o usuário da sala
const leaveRoom = (socket) => {
    const socketId = socket.id
    const roomId = game.rooms[socketId].room
    const room = game.rooms[socketId]

    if (room) {
        const match = game.match[roomId]

        game.players[socketId].room = undefined

        let playerNumber = 'player'
        for (let i = 1; i <= 4; i++) {
            if (room[`player${i}`] === socketId) {
                playerNumber += i;
                room[`player${i}`] = null;
                break;
            }
        }

        if (match) {
            match[playerNumber] = undefined
            match.status = 'END'
            match.message = `O jogador ${game.players[socketId].name} desconectou`
        }

        console.log(`Players in room ${roomId}: ${room.player1} ${room.player2} ${room.player3} ${room.player4}`);

        if (!room.player1 && !room.player2 && !room.player3 && !room.player4) {
            delete game.rooms[roomId]
            if (match) {
                delete game.match[roomId]
                console.log(`Room ${roomId} deleted`);
            }
        }

        refreshMatch(roomId)
        socket.leave(roomId)
    }
}


const sendMessage = (player, message) => {
    sockets.emit("ReceiveMessage", `${player.name}: ${message}`)
}

const finishGame = (bool) => {
    sockets.emit("FinishGame", bool)
}

const sizeWord = (size) => {
    sockets.emit("VerifySizeLetter", size)
}

const refreshPlayers = () => {
    sockets.emit("PlayersRefresh", game.players)
}

const refreshRooms = () => {
    sockets.emit("RoomsRefresh", game.rooms)
}

const refreshMatch = (roomId) => {
    sockets.to(roomId).emit('MatchRefresh', game.match[roomId] || {})
}

const refreshReadyPlayers = (contador) => {
    sockets.emit("ReadyPlayersRefresh", contador)
}

const everyoneIsReady = () => {
    sockets.emit("EveryoneIsReady", true)
}

const gameInProgress = (bool) => {
    sockets.emit("GameInProcess", bool)
}

app.get("/", (req, res) => res.json({
    sucess: true,
    message: 'Sucesso'
}))

app.get('/jogador/:id', function (req, res) {
    const jogadorId = req.params.id;
    // aqui você pode usar o ID do jogador para carregar dados específicos do jogador
    // e renderizar uma página personalizada para ele
});

const port = 4000
server.listen(process.env.PORT || port, () => console.log(`Server rodando na porta ${port}`))


