const fs = require("fs");
const path = require("path");
const https = require("https");

const textures = [
  {
    url: "https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/terrain/grasslight-big.jpg",
    filename: "grass.jpg",
  },
  {
    url: "https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/brick_diffuse.jpg",
    filename: "brick.jpg",
  },
  {
    url: "https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/hardwood2_diffuse.jpg",
    filename: "wood.jpg",
  },
];

const downloadTexture = (url, filename) => {
  const filepath = path.join(__dirname, "../public/textures", filename);
  const file = fs.createWriteStream(filepath);

  https
    .get(url, (response) => {
      response.pipe(file);

      file.on("finish", () => {
        file.close();
        console.log(`Downloaded ${filename}`);
      });
    })
    .on("error", (err) => {
      fs.unlink(filepath);
      console.error(`Error downloading ${filename}: ${err.message}`);
    });
};

// Create directory if it doesn't exist
const texturesDir = path.join(__dirname, "../public/textures");
if (!fs.existsSync(texturesDir)) {
  fs.mkdirSync(texturesDir, { recursive: true });
}

// Download all textures
textures.forEach((texture) => {
  downloadTexture(texture.url, texture.filename);
});
