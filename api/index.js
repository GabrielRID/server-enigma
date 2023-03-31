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

// Aqui é onde vai ser elaborado a parte de código de enviar e receber no servidor
sockets.on('connection', (socket) => {
    console.log(`${socket.id} conectado`)

    const name = 'Player_' + socket.id.substring(0, 5)
    game.players[socket.id] = { name }
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
            if (room[`player${i}`] === socket.id) {
                playerNumber += i
                break
            }
        }
        room[playerNumber] = socket.id
        game.players[socket.id].room = roomId

        if(room.player1 && room.player2 && room.player3 && room.player4) {
            game.match[roomId] = {
                gameConfig,
                player1: {
                    ready: false,
                    score: 2000
                },
                player2: {
                    ready: false,
                    score: 2000
                },
                player3: {
                    ready: false,
                    score: 2000
                },
                player4: {
                    ready: false,
                    score: 2000
                },
                time: 1200
            }
            gameInProgress(roomId)
        }

        console.log(`${game.players[socket.id].name} entrou na sala`)
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
                playerNumber += i
                break
            }
        }

        if(match) {
            match[playerNumber] = undefined
            match.status = 'END'
            match.message = `O jogador ${game.players[socketId].name} desconectou`
        }

        if(!room.player1 && !room.player2 && !room.player3 && !room.player4) {
            delete game.rooms[socketId]
            if(match) {
                delete game.match[roomId]
            }
        }

        refreshMatch(roomId)

    }
}

const sendMessage = (player, message) => {
    sockets.emit("ReceiveMessage", `${player.name}: ${message}`)
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

app.get("/", (req, res) => res.send("Rodando"))
const port = 4000
server.listen(port, () => console.log(`Server rodando na porta ${port}`))


