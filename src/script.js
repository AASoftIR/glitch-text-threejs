import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import GUI from "lil-gui";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";

/**
 * Base
 */
// Debug
const gui = new GUI();

// Canvas
const canvas = document.querySelector("canvas.webgl");

// Scene
const scene = new THREE.Scene();

// Loaders
const fontLoader = new FontLoader();

// Text input
const textInput = document.getElementById("textInput");

/**
 * Sizes
 */
const sizes = {
	width: window.innerWidth,
	height: window.innerHeight,
};

window.addEventListener("resize", () => {
	// Update sizes
	sizes.width = window.innerWidth;
	sizes.height = window.innerHeight;

	// Update camera
	camera.aspect = sizes.width / sizes.height;
	camera.updateProjectionMatrix();

	// Update renderer
	renderer.setSize(sizes.width, sizes.height);
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(
	25,
	sizes.width / sizes.height,
	0.1,
	100
);
camera.position.set(0, 0, 15);
scene.add(camera);

// Controls
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

/**
 * Renderer
 */
const rendererParameters = {
	clearColor: "#1d1f2a",
};

const renderer = new THREE.WebGLRenderer({
	canvas: canvas,
	antialias: true,
});
renderer.setClearColor(rendererParameters.clearColor);
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

gui.addColor(rendererParameters, "clearColor").onChange(() => {
	renderer.setClearColor(rendererParameters.clearColor);
});

/**
 * Material
 */
const tweek = {
	color: new THREE.Color(0x00ff00),
	textSize: 3, // New parameter for text size
};
const material = new THREE.ShaderMaterial({
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
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
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
	material.uniforms.uColor.value = new THREE.Color(tweek.color);
});

// Add GUI control for text size
gui
	.add(tweek, "textSize", 0.1, 3, 0.1)
	.name("Text Size")
	.onChange(() => {
		if (font) {
			createText(textInput.value);
		}
	});

/**
 * Text
 */
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
		size: tweek.textSize, // Use the adjustable size parameter
		height: tweek.textSize * 0.2, // Adjust height proportionally
		curveSegments: 12,
		bevelEnabled: true,
		bevelThickness: tweek.textSize * 0.03, // Adjust bevel proportionally
		bevelSize: tweek.textSize * 0.02,
		bevelOffset: 0,
		bevelSegments: 5,
	});
	textGeometry.center();

	textMesh = new THREE.Mesh(textGeometry, material);
	scene.add(textMesh);
}

// Event listener for text input
textInput.addEventListener("input", (event) => {
	if (font) {
		let txt = "";
		let val = event.target.value.split(" ").forEach((word) => {
			if (word.length > 0) txt += word[0].toUpperCase() + word.slice(1) + " ";
		});
		createText(txt);
	}
});

/**
 * Animate
 */
const clock = new THREE.Clock();

const tick = () => {
	const elapsedTime = clock.getElapsedTime();

	material.uniforms.uTime.value = elapsedTime;

	// Rotate text
	if (textMesh) {
		textMesh.rotation.x = -elapsedTime * 0.1;
		textMesh.rotation.y = elapsedTime * 0.2;
	}

	// Update controls
	controls.update();

	// Render
	renderer.render(scene, camera);

	// Call tick again on the next frame
	window.requestAnimationFrame(tick);
};

tick();
