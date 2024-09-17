import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import GUI from "lil-gui";
import gsap from "gsap";
import { Sky } from "three/addons/objects/Sky.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";

/**
 * Base
 */
// Debug
const gui = new GUI({ width: 340 });

// Canvas
const canvas = document.querySelector("canvas.webgl");

// Scene
const scene = new THREE.Scene();

// Loaders
const textureLoader = new THREE.TextureLoader();
const fontLoader = new FontLoader();

// Text input
const textInput = document.getElementById("textInput");

/**
 * Sizes
 */
const sizes = {
	width: window.innerWidth,
	height: window.innerHeight,
	pixelRatio: Math.min(window.devicePixelRatio, 2),
};
sizes.resolution = new THREE.Vector2(
	sizes.width * sizes.pixelRatio,
	sizes.height * sizes.pixelRatio
);

window.addEventListener("resize", () => {
	// Update sizes
	sizes.width = window.innerWidth;
	sizes.height = window.innerHeight;

	// Update camera
	camera.aspect = sizes.width / sizes.height;
	camera.updateProjectionMatrix();
	sizes.pixelRatio = Math.min(window.devicePixelRatio, 2);
	sizes.resolution.set(
		sizes.width * sizes.pixelRatio,
		sizes.height * sizes.pixelRatio
	);

	// Update renderer
	renderer.setSize(sizes.width, sizes.height);
	renderer.setPixelRatio(sizes.pixelRatio);
});

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(
	75,
	sizes.width / sizes.height,
	0.1,
	100
);
camera.position.set(1.5, 0, 6);
scene.add(camera);

// Controls
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
	canvas: canvas,
	antialias: true,
});
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

/**
 * Fireworks
 */
const textures = [
	textureLoader.load("./particles/1.png"),
	textureLoader.load("./particles/2.png"),
	textureLoader.load("./particles/3.png"),
	textureLoader.load("./particles/4.png"),
	textureLoader.load("./particles/5.png"),
	textureLoader.load("./particles/6.png"),
	textureLoader.load("./particles/7.png"),
	textureLoader.load("./particles/8.png"),
];

let createFireworks = (
	count,
	vec,
	size,
	texture,
	radius = 1,
	color = new THREE.Color(0x00ffff)
) => {
	let positionArray = new Float32Array(count * 3);
	let sizesArray = new Float32Array(count * 1);
	let timer = new Float32Array(count * 1);
	for (let i = 0; i < count; i++) {
		let i3 = 3 * i;
		let s = new THREE.Spherical(
			radius * (0.75 + Math.random() * 0.25),
			Math.random() * Math.PI,
			Math.random() * Math.PI * 2
		);
		const pos = new THREE.Vector3().setFromSpherical(s);
		positionArray[i3] = pos.x;
		positionArray[i3 + 1] = pos.y;
		positionArray[i3 + 2] = pos.z;

		sizesArray[i] = Math.random();
		timer[i] = 1 + Math.random();
	}
	let geometry = new THREE.BufferGeometry();
	geometry.setAttribute(
		"position",
		new THREE.Float32BufferAttribute(positionArray, 3)
	);
	geometry.setAttribute(
		"sizes",
		new THREE.Float32BufferAttribute(sizesArray, 1)
	);
	geometry.setAttribute("timer", new THREE.Float32BufferAttribute(timer, 1));
	texture.flipY = false;
	const material = new THREE.ShaderMaterial({
		vertexShader: `
        uniform float uSize;
        uniform vec2 uResolution;
        uniform float uProgress;
        attribute float sizes;
        attribute float timer;
        float remap(float value, float originMin, float originMax, float destinationMin, float destinationMax)
        {
            return destinationMin + (value - originMin) * (destinationMax - destinationMin) / (originMax - originMin);
        }
        void main(){
            // Final position
            vec3 newPos=position;
            float progress = uProgress * timer;

            // Exploding
            float explodingProgress = remap(progress, 0.0, 0.1, 0.0, 1.0);
            explodingProgress = clamp(explodingProgress, 0.0, 1.0);
            explodingProgress = 1.0 - pow(1.0 - explodingProgress, 3.0);
            newPos *= explodingProgress;

            // Falling
            float fallingProgress = remap(progress, 0.1, 1.0, 0.0, 1.0);
            fallingProgress = clamp(fallingProgress, 0.0, 1.0);
            fallingProgress = 1.0 - pow(1.0 - fallingProgress, 3.0);
            newPos.y -= fallingProgress * 0.2;

            // Scaling
            float sizeOpeningProgress = remap(progress, 0.0, 0.125, 0.0, 1.0);
            float sizeClosingProgress = remap(progress, 0.125, 1.0, 1.0, 0.0);
            float sizeProgress = min(sizeOpeningProgress, sizeClosingProgress);
            sizeProgress = clamp(sizeProgress, 0.0, 1.0);

            // Twinkling
            float twinklingProgress = remap(progress, 0.2, 0.8, 0.0, 1.0);
            twinklingProgress = clamp(twinklingProgress, 0.0, 1.0);
            float sizeTwinkling = sin(progress * 30.0) * 0.5 + 0.5;
            sizeTwinkling = 1.0 - sizeTwinkling * twinklingProgress;

            vec4 modelPosition = modelMatrix * vec4(newPos, 1.0);
            vec4 viewPosition = viewMatrix * modelPosition;
            gl_Position = projectionMatrix * viewPosition;
            gl_PointSize=uSize*uResolution.y*sizes* sizeProgress * sizeTwinkling;
            gl_PointSize *= 1.0 / - viewPosition.z;
            if(gl_PointSize<1.0)
                gl_Position=vec4(9999.9);
        }
        `,
		fragmentShader: `
        uniform sampler2D uTexture;
        uniform vec3 uColor;
        void main(){
        float tex = texture(uTexture, gl_PointCoord).r;
            gl_FragColor = vec4(uColor, tex);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
        }
        `,
		depthWrite: false,
		blending: THREE.AdditiveBlending,
		uniforms: {
			uTime: {
				value: 0,
			},
			uSize: new THREE.Uniform(size),
			uResolution: new THREE.Uniform(sizes.resolution),
			uTexture: new THREE.Uniform(texture),
			uColor: new THREE.Uniform(color),
			uProgress: new THREE.Uniform(0),
		},
		transparent: true,
	});
	const firework = new THREE.Points(geometry, material);
	firework.position.copy(vec);
	scene.add(firework);
	gsap.to(material.uniforms.uProgress, {
		value: 1,
		duration: 3,
		ease: "linear",
		onComplete: () => {
			scene.remove(firework);
			geometry.dispose();
			material.dispose();
		},
	});
};

function randomer() {
	const count = Math.round(400 + Math.random() * 1000);
	const position = new THREE.Vector3(
		(Math.random() - 0.5) * 15,
		Math.random(),
		(Math.random() - 0.5) * 15
	);
	const size = 0.2 + Math.random() * 0.2;
	const texture = textures[Math.floor(Math.random() * textures.length)];
	const radius = 2 + Math.random() * 1.5;
	const color = new THREE.Color();
	color.setHSL(Math.random(), 1, 0.7);
	createFireworks(count, position, size, texture, radius, color);
}

createFireworks(
	100,
	new THREE.Vector3(),
	0.4,
	textures[Math.floor(Math.random() * 8)]
);
window.addEventListener("click", randomer);

/**
 * Sky
 */
const sky = new Sky();
sky.scale.setScalar(450000);
scene.add(sky);

const sun = new THREE.Vector3();

const skyParameters = {
	turbidity: 10,
	rayleigh: 3,
	mieCoefficient: 0.005,
	mieDirectionalG: 0.95,
	elevation: -2.2,
	azimuth: 180,
	exposure: renderer.toneMappingExposure,
};
const updateSky = () => {
	const uniforms = sky.material.uniforms;
	uniforms["turbidity"].value = skyParameters.turbidity;
	uniforms["rayleigh"].value = skyParameters.rayleigh;
	uniforms["mieCoefficient"].value = skyParameters.mieCoefficient;
	uniforms["mieDirectionalG"].value = skyParameters.mieDirectionalG;

	const phi = THREE.MathUtils.degToRad(90 - skyParameters.elevation);
	const theta = THREE.MathUtils.degToRad(skyParameters.azimuth);

	sun.setFromSphericalCoords(1, phi, theta);

	uniforms["sunPosition"].value.copy(sun);

	renderer.toneMappingExposure = skyParameters.exposure;
	renderer.render(scene, camera);
};

gui.add(skyParameters, "turbidity", 0.0, 20.0, 0.1).onChange(updateSky);
gui.add(skyParameters, "rayleigh", 0.0, 4, 0.001).onChange(updateSky);
gui.add(skyParameters, "mieCoefficient", 0.0, 0.1, 0.001).onChange(updateSky);
gui.add(skyParameters, "mieDirectionalG", 0.0, 1, 0.001).onChange(updateSky);
gui.add(skyParameters, "elevation", -10, 10, 0.01).onChange(updateSky);
gui.add(skyParameters, "azimuth", -180, 180, 0.1).onChange(updateSky);
gui.add(skyParameters, "exposure", 0, 1, 0.0001).onChange(updateSky);

updateSky();

/**
 * Glitchy Text
 */
const tweek = {
	color: new THREE.Color(0x00ff00),
	textSize: 2.2,
};

const textMaterial = new THREE.ShaderMaterial({
	vertexShader: `
        varying vec3 vPosition;
        varying vec3 vNormal;
        uniform float uTime;

        float random2D(vec2 value)
        {
            return fract(sin(dot(value.xy, vec2(12.9898,78.233))) * 43758.5453123);
        }
        void main() {
            vec4 modelPosition = modelMatrix * vec4(position, 1.0);
            float g = uTime - modelPosition.y;
            float glitchStrength = sin(g) + sin(g * 3.45) + sin(g * 8.76);
            glitchStrength /= 3.0;
            glitchStrength = smoothstep(0.3, 1.0, glitchStrength);
            glitchStrength *= 0.25;
            modelPosition.x += (random2D(modelPosition.xz + uTime) - 0.5) * glitchStrength;
            modelPosition.z += (random2D(modelPosition.zx + uTime) - 0.5) * glitchStrength;

            gl_Position = projectionMatrix * viewMatrix * modelPosition;
            vPosition = modelPosition.xyz;
            vec4 modelNormal = modelMatrix * vec4(normal, 0.0);
            vNormal = modelNormal.xyz;
        }
    `,
	fragmentShader: `
        varying vec3 vPosition;
        uniform float uTime;
        varying vec3 vNormal;
        uniform vec3 uColor;

        void main() {
            float stripes = pow(mod((vPosition.y - uTime * 0.02) * 20.0, 1.0), 3.0);
            vec3 viewDir = normalize(vPosition - cameraPosition);
            vec3 normal = normalize(vNormal);
            if (!gl_FrontFacing)
                normal *= -1.0;
            float fresnel = pow(dot(viewDir, normal) + 1.0, 2.0);
            float falloff = smoothstep(0.8, 0.0, fresnel);
            gl_FragColor = vec4(uColor, ((fresnel * stripes) + (fresnel * 1.25)) * falloff);
        }
    `,
	uniforms: {
		uTime: { value: 0 },
		uColor: { value: tweek.color },
	},
	transparent: true,
	side: THREE.DoubleSide,
	depthWrite: false,
	blending: THREE.AdditiveBlending,
});

gui.addColor(tweek, "color").onChange(() => {
	textMaterial.uniforms.uColor.value = new THREE.Color(tweek.color);
});

gui
	.add(tweek, "textSize", 2, 10, 0.1)
	.name("Text Size")
	.onChange(() => {
		if (font) {
			createText(textInput.value || "AASoft");
		}
	});

let textMesh;
let font;

fontLoader.load("/Juice ITC_Regular.json", (loadedFont) => {
	font = loadedFont;
	createText("AASoft");
});

function createText(text) {
	if (textMesh) {
		scene.remove(textMesh);
		textMesh.geometry.dispose();
	}

	const textGeometry = new TextGeometry(text, {
		font: font,
		size: tweek.textSize,
		height: tweek.textSize * 0.2,
		curveSegments: 12,
		bevelEnabled: true,
		bevelThickness: tweek.textSize * 0.03,
		bevelSize: tweek.textSize * 0.02,
		bevelOffset: 0,
		bevelSegments: 5,
	});
	textGeometry.center();

	textMesh = new THREE.Mesh(textGeometry, textMaterial);
	scene.add(textMesh);
}

textInput.addEventListener("input", (event) => {
	if (font) {
		let txt = "";
		event.target.value.split(" ").forEach((word) => {
			if (word.length > 0) txt += word[0].toUpperCase() + word.slice(1) + " ";
		});
		createText(txt.trim());
	}
});

/**
 * Animate
 */
const clock = new THREE.Clock();

const tick = () => {
	const elapsedTime = clock.getElapsedTime();

	// Update text material
	textMaterial.uniforms.uTime.value = elapsedTime;

	// Rotate text
	if (textMesh) {
		textMesh.rotation.x = Math.sin(elapsedTime * 0.5) * 0.1;
		textMesh.rotation.y = Math.cos(elapsedTime * 0.3) * 0.1;
	}

	// Update controls
	controls.update();

	// Render
	renderer.render(scene, camera);

	// Call tick again on the next frame
	window.requestAnimationFrame(tick);
};

tick();
