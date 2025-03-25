# RC Car 3D Experience

A 3D web experience inspired by Bruno Simon's style, featuring an RC car driving along a track with informational signs.

## Setup

Follow these steps to set up and run the project:

1. Install dependencies:
```bash
npm install
```

2. Run development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

## Required Assets

This project requires certain 3D models and textures to work properly. You'll need to place these files in the specified directories:

### 3D Models
- Download an RC car model (GLB format) from Sketchfab
- Place it in `/public/models/rc_car.glb`

### Textures
Create the following directories and add the required textures:

- `/public/textures/signs/` - For sign textures:
  - `xyz_sign.jpg`
  - `xy_sign.jpg`
  - `wave_sign.jpg`

- `/public/textures/track/` - For track texture:
  - `dark_track.jpg`

- `/public/textures/environmentMap/` - For environment cubemap:
  - `px.jpg`, `nx.jpg`, `py.jpg`, `ny.jpg`, `pz.jpg`, `nz.jpg`

## Customization

You can customize various aspects of the experience:

- Change the track shape in `src/js/world/Track.js`
- Modify the car speed in `src/js/world/RCCar.js`
- Update sign content by replacing the sign textures
- Adjust lighting in `src/js/world/Environment.js`

## Features

- 3D RC car model following a looping track
- Multiple signs positioned along the track
- Camera controls to view the scene from different angles
- Smooth loading animation
- Responsive design 