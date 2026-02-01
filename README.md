# CelestialMechanics

**Live Preview:** https://celestial-mechanics.vercel.app/

**CelestialMechanics** is a scientifically accurate, visually stunning 3D space simulation platform. It allows users to observe and simulate the universe using realistic N-body physics, rendering celestial bodies from comets to black holes with high-fidelity visuals.

## 🌟 Features

*   **Scientific N-Body Physics**: Real-time gravitational simulation using Velocity Verlet integration for stable orbits.
*   **Realistic Rendering**: High-quality visuals for stars (spectral classes O-M), planets, and exotic objects like black holes.
*   **Interactive Placement System**: Intuitive controls to place objects in 3D space, with velocity drag interactions and mouse-wheel depth control.
*   **Comprehensive Object Library**:
    *   **Celestial Objects**: Comets, asteroids, rocky/gas planets, diverse star types, neutron stars, and black holes.
    *   **Structures**: Nebulas and star systems (planned/experimental).
*   **Data-Rich Interface**: Real-time readouts of kinetic/potential energy, velocity vectors, and orbital paths.
*   **Performance Optimized**: Physics calculations run in a dedicated Web Worker to ensure smooth rendering at high frame rates.

## 🛠️ Technology Stack

*   **Core**: [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
*   **3D Engine**: [Three.js](https://threejs.org/) via [React Three Fiber](https://docs.pmnd.rs/react-three-fiber)
*   **State Management**: [Zustand](https://github.com/pmndrs/zustand)
*   **Build Tool**: [Vite](https://vitejs.dev/)
*   **Desktop Wrapper**: [Electron](https://www.electronjs.org/) (Optional)

## 🚀 Getting Started

### Prerequisites

*   Node.js (v18 or higher)
*   npm or yarn

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/SharonMathew4/CelestialMechanics.git
    cd CelestialMechanics
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Start the development server:
    ```bash
    npm run dev
    ```

4.  Open your browser at `http://localhost:3000`.

### Building for Production

To create a production build:

```bash
npm run build
```

To build the desktop application (Electron):

```bash
npm run electron:build
```

## 🎮 Controls

| Action | Control |
|--------|---------|
| **Orbit Camera** | Left Mouse Drag |
| **Pan Camera** | Right Mouse Drag |
| **Zoom** | Mouse Scroll |
| **Pause/Resume** | `Space` |
| **Time Scale** | `[` (Slower) / `]` (Faster) |
| **Reset Time** | `` ` `` (Backtick) |
| **Place Object** | Complete object placement sequence |
| **Cancel Placement** | `Esc` or Right Click |

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on how to submit pull requests, report issues, and the code of conduct.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Security

For security concerns, please refer to [SECURITY.md](SECURITY.md).

---

Built with ❤️ by the CelestialMechanics Team.
