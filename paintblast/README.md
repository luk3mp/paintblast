# PaintBlast - Multiplayer Paintball Game

PaintBlast is a 3D multiplayer paintball game using Three.js, React Three Fiber,
and WebSocket for real-time gameplay.

## Features

- Fast-paced 3D paintball action
- Team-based capture the flag gameplay
- Multiplayer support for up to 100 players
- Automatic team balancing system
- Queue system for managing high player load
- Real-time chat functionality
- Responsive performance optimization

## Getting Started

First, install the dependencies:

```bash
npm install
# or
yarn install
```

Then, run the development server:

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to play
the game in single-player mode.

## Multiplayer Server

To enable multiplayer functionality, you need to run the WebSocket server:

1. Navigate to the server directory:

```bash
cd server
```

2. Install Python dependencies:

```bash
pip install -r requirements.txt
```

3. Start the server:

```bash
python app.py
```

The server will start on `http://localhost:8000`. By default, the game will
attempt to connect to this address for multiplayer functionality.

## Queue System

PaintBlast features a sophisticated queue system that enables smooth handling of
up to 100 players:

- When the server reaches its maximum player capacity, new players are
  automatically placed in a queue
- Players in queue can see their position and estimated wait time
- As players leave the game, players in queue are automatically moved into the
  game
- The queue system ensures fair and efficient player management during peak
  times
- Team balancing is automatically enforced to maintain fair teams

## Game Controls

- **WASD** - Move character
- **Mouse** - Look around
- **Left Click** - Shoot paintball
- **R** - Reload paintball gun
- **Shift** - Sprint
- **F** - Capture or return flag (when near flag)
- **Enter** - Open chat
- **Esc** - Exit pointer lock

## Configuration

The game can be configured by modifying files in the `src/lib` directory:

- `config.js` - Server URL, multiplayer settings, and game constants
- `socket.js` - Socket connection management and event handling
- `events.js` - Custom event system for cross-component communication

## Performance Settings

The game automatically adjusts visual quality based on performance:

- High: Full shadow quality, maximum paintball count, and visual effects
- Medium: Reduced shadow quality and effects for better performance
- Low: Minimal visual effects to ensure smooth gameplay on lower-end hardware

## Learn More

This project was built with:

- [Next.js](https://nextjs.org/) - React framework
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) - Three.js
  renderer for React
- [Socket.IO](https://socket.io/) - WebSocket communication
- [Flask-SocketIO](https://flask-socketio.readthedocs.io/) - Python WebSocket
  server

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the
[Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme)
from the creators of Next.js.

Check out our
[Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying)
for more details.
