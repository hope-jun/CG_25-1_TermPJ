// 공기 오염 표현용 레이어 추가
let pollutionOverlay;  

// [1] 게임오버 : 정전 및 경고메세지 표출을 위한 요소 추가
// [1]-1 검정색 오버레이 추가
const blackoutOverlay = document.createElement('div');
blackoutOverlay.id = 'blackout-overlay';
blackoutOverlay.style = `
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: black;
  opacity: 0;
  transition: opacity 2s ease-out;
  z-index: 998;
  pointer-events: none;
`;
document.body.appendChild(blackoutOverlay);

// [1]-2 경고 텍스트 + 공익 메시지 추가
const warningElem = document.createElement('div');
warningElem.id = 'power-warning';
warningElem.innerHTML = `
  ⚠️ POWER OUTAGE ⚠️<br/>
  <span style="font-size: 18px; font-weight: normal;">
    Overuse of AI may harm the environment and energy supply.
  </span>
`;
warningElem.style = `
  position: absolute;
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 48px;
  font-weight: bold;
  color: red;
  display: none;
  text-align: center;
  animation: blink 1s infinite;
  z-index: 999;
`;
document.body.appendChild(warningElem);

// [1]-3 깜빡임 애니메이션 정의
const style = document.createElement('style');
style.innerHTML = `
  @keyframes blink {
    0%, 100% { opacity: 0; }
    50% { opacity: 1; }
  }
`;
document.head.appendChild(style);


// [2] smoke 효과 관련 texture
const smokeTextures = []
const smokeLoader = new THREE.TextureLoader()
smokeLoader.load('/textures/smoke.png', (texture) => {
	for (let i = 0; i < 100; i++) {
		smokeTextures.push(texture)
	}
})
// 
class SmokeParticle {
  constructor(position) {
    // 랜덤 텍스처
    const tex = smokeTextures[Math.floor(Math.random() * smokeTextures.length)];
    this.material = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: 0x555555,
    });
    this.sprite = new THREE.Sprite(this.material);
    this.sprite.position.copy(position);
    // 초기 스케일 랜덤
    const initScale = 30 + Math.random() * 30;
    this.sprite.scale.set(initScale, initScale, 1);

    scene.add(this.sprite);

    this.lifetime = 0;
    // 파티클 수명(ms)
    this.maxLife = 2000 + Math.random() * 2000;
    // 랜덤 드리프트 속도
    this.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 0.01,
      0.05 + Math.random() * 0.03,
      (Math.random() - 0.5) * 0.01
    );
    // 랜덤 회전 속도
    this.rotationSpeed = (Math.random() - 0.5) * 0.02;
  }

  tick(deltaTime) {
    this.lifetime += deltaTime;

    const t = this.lifetime / this.maxLife;
    // 페이드 인/아웃
    // if (t < 0.3) {
    //   this.material.opacity = THREE.MathUtils.lerp(0, 0.3, t / 0.3);
    // } else {
    //   this.material.opacity = THREE.MathUtils.lerp(0.3, 0, (t - 0.3) / 0.7);
    // }
	const maxOpacity = 0.1; // 0.5 → 0.3
    if (t < 0.3) {
      this.material.opacity = THREE.MathUtils.lerp(0, maxOpacity, t / 0.3);	
	 } else {
      this.material.opacity = THREE.MathUtils.lerp(0.5, 0, (t - 0.3) / 0.7);
      this.material.opacity = THREE.MathUtils.lerp(maxOpacity, 0, (t - 0.3) / 0.7);
    }

    // 크기 팽창
    const scale = this.sprite.scale.x * (1 + deltaTime / this.maxLife);
    this.sprite.scale.set(scale, scale, 1);

    // 위치 업데이트
    this.sprite.position.addScaledVector(this.velocity, deltaTime);

    // 회전 업데이트
    this.sprite.material.rotation += this.rotationSpeed * deltaTime;

    // 수명 종료 시 제거
    if (this.lifetime > this.maxLife) {
      scene.remove(this.sprite);
      return false;
    }
    return true;
  }
}

const smokeManager = {
  smokes: [],

  add(position) {
    // 레벨에 따라 한 번에 여러 파티클 생성
    const count = 1 + Math.floor(game.level / 2);
    for (let i = 0; i < count; i++) {
      smokeManager.smokes.push(new SmokeParticle(position.clone()));
    }
  },

  tick(deltaTime) {
    this.smokes = this.smokes.filter(s => s.tick(deltaTime));
  }
};

function spawnBackgroundSmoke(deltaTime) {
// 레벨 1에는 연기 생성 없음(skip) : clear 한 상태
  if (game.level <= 1) {
    smokeManager.tick(deltaTime);
    return;
  }
  // 1) 매 프레임당 한두 번만 생성하도록 임계치
  // 생성 환률 0.1(10%)로 설정
  if (Math.random() > 0.05) {
    smokeManager.tick(deltaTime);
    return;
  }

  // 2) 레벨에 비례해 생성 개수 증가
  // const count = Math.min(game.level, 10);
  // 레벨 2부터 3레벨까지는 1개, 그 이후에만 레벨/2개 생성
  let count;
  if (game.level <= 3) {
    count = 1;
  } else {
    count = Math.min(Math.ceil((game.level - 2) / 2), 3);
  }

  for (let i = 0; i < count; i++) {
    // 카메라 뷰 앞쪽 랜덤 위치 (월드 좌표로 변환)
    const ndcX = (Math.random() - 0.5) * 2;  // -1 ~ +1
    const ndcY = -1;                       // 화면 하단
    const vec = new THREE.Vector3(ndcX, ndcY, -0.5);
    // screen → world
    vec.unproject(camera);
    // 카메라에서 뿌옇게 보이도록 약간 뒤로
    const dir = vec.sub(camera.position).normalize();
    const spawnPos = camera.position.clone().add(dir.multiplyScalar(200));
    smokeManager.add(spawnPos);
  }

  // 3) 모든 파티클 업데이트
  smokeManager.tick(deltaTime);
}


function createAirplaneMesh() {
	const mesh = new THREE.Object3D()

	// Cabin
	var matCabin = new THREE.MeshPhongMaterial({color: Colors.red, flatShading: true, side: THREE.DoubleSide})

	const frontUR = [ 40,  25, -25]
	const frontUL = [ 40,  25,  25]
	const frontLR = [ 40, -25, -25]
	const frontLL = [ 40, -25,  25]
	const backUR  = [-40,  15,  -5]
	const backUL  = [-40,  15,   5]
	const backLR  = [-40,   5,  -5]
	const backLL  = [-40,   5,   5]

	const vertices = new Float32Array(
		utils.makeTetrahedron(frontUL, frontUR, frontLL, frontLR).concat(   // front
		utils.makeTetrahedron(backUL, backUR, backLL, backLR)).concat(      // back
		utils.makeTetrahedron(backUR, backLR, frontUR, frontLR)).concat(    // side
		utils.makeTetrahedron(backUL, backLL, frontUL, frontLL)).concat(    // side
		utils.makeTetrahedron(frontUL, backUL, frontUR, backUR)).concat(    // top
		utils.makeTetrahedron(frontLL, backLL, frontLR, backLR))            // bottom
	)
	const geomCabin = new THREE.BufferGeometry()
	geomCabin.setAttribute('position', new THREE.BufferAttribute(vertices, 3))

	var cabin = new THREE.Mesh(geomCabin, matCabin)
	cabin.castShadow = true
	cabin.receiveShadow = true
	mesh.add(cabin)

	// Engine

	var geomEngine = new THREE.BoxGeometry(20,50,50,1,1,1);
	var matEngine = new THREE.MeshPhongMaterial({color:Colors.white, flatShading:true,});
	var engine = new THREE.Mesh(geomEngine, matEngine);
	//Ð¿Ð¾Ð·Ð¸Ñ†Ð¸Ñ
	engine.position.x = 50;
	engine.castShadow = true;
	engine.receiveShadow = true;
	mesh.add(engine);

	// Tail Plane
	var geomTailPlane = new THREE.BoxGeometry(15,20,5,1,1,1);
	var matTailPlane = new THREE.MeshPhongMaterial({color:Colors.red, flatShading:true,});
	var tailPlane = new THREE.Mesh(geomTailPlane, matTailPlane);
	//Ð¿Ð¾Ð·Ð¸Ñ†Ð¸Ñ
	tailPlane.position.set(-40,20,0);
	tailPlane.castShadow = true;
	tailPlane.receiveShadow = true;
	mesh.add(tailPlane);

	// Wings

	var geomSideWing = new THREE.BoxGeometry(30,5,120,1,1,1);
	var matSideWing = new THREE.MeshPhongMaterial({color:Colors.red, flatShading:true,});
	var sideWing = new THREE.Mesh(geomSideWing, matSideWing);
	//Ð¿Ð¾Ð·Ð¸Ñ†Ð¸Ñ
	sideWing.position.set(0,15,0);
	sideWing.castShadow = true;
	sideWing.receiveShadow = true;
	mesh.add(sideWing);

	var geomWindshield = new THREE.BoxGeometry(3,15,20,1,1,1);
	var matWindshield = new THREE.MeshPhongMaterial({color:Colors.white,transparent:true, opacity:.3, flatShading:true,});;
	var windshield = new THREE.Mesh(geomWindshield, matWindshield);
	windshield.position.set(20,27,0);

	windshield.castShadow = true;
	windshield.receiveShadow = true;

	mesh.add(windshield);

	var geomPropeller = new THREE.BoxGeometry(20, 10, 10, 1, 1, 1);
	geomPropeller.attributes.position.array[4*3+1] -= 5
	geomPropeller.attributes.position.array[4*3+2] += 5
	geomPropeller.attributes.position.array[5*3+1] -= 5
	geomPropeller.attributes.position.array[5*3+2] -= 5
	geomPropeller.attributes.position.array[6*3+1] += 5
	geomPropeller.attributes.position.array[6*3+2] += 5
	geomPropeller.attributes.position.array[7*3+1] += 5
	geomPropeller.attributes.position.array[7*3+2] -= 5
	var matPropeller = new THREE.MeshPhongMaterial({color:Colors.brown, flatShading:true,});
	const propeller = new THREE.Mesh(geomPropeller, matPropeller);

	propeller.castShadow = true;
	propeller.receiveShadow = true;

	var geomBlade = new THREE.BoxGeometry(1,80,10,1,1,1);
	var matBlade = new THREE.MeshPhongMaterial({color:Colors.brownDark, flatShading:true,});
	var blade1 = new THREE.Mesh(geomBlade, matBlade);
	//Ð¿Ð¾Ð·Ð¸Ñ†Ð¸Ñ
	blade1.position.set(8,0,0);

	blade1.castShadow = true;
	blade1.receiveShadow = true;

	var blade2 = blade1.clone();
	blade2.rotation.x = Math.PI/2;

	blade2.castShadow = true;
	blade2.receiveShadow = true;

	propeller.add(blade1);
	propeller.add(blade2);
	propeller.position.set(60,0,0);
	mesh.add(propeller);

	var wheelProtecGeom = new THREE.BoxGeometry(30,15,10,1,1,1);
	var wheelProtecMat = new THREE.MeshPhongMaterial({color:Colors.red, flatShading:true,});
	var wheelProtecR = new THREE.Mesh(wheelProtecGeom,wheelProtecMat);
	//Ð¿Ð¾Ð·Ð¸Ñ†Ð¸Ñ
	wheelProtecR.position.set(25,-20,25);
	mesh.add(wheelProtecR);

	var wheelTireGeom = new THREE.BoxGeometry(24,24,4);
	var wheelTireMat = new THREE.MeshPhongMaterial({color:Colors.brownDark, flatShading:true,});
	var wheelTireR = new THREE.Mesh(wheelTireGeom,wheelTireMat);
	//Ð¿Ð¾Ð·Ð¸Ñ†Ð¸Ñ
	wheelTireR.position.set(25,-28,25);

	var wheelAxisGeom = new THREE.BoxGeometry(10,10,6);
	var wheelAxisMat = new THREE.MeshPhongMaterial({color:Colors.brown, flatShading:true,});
	var wheelAxis = new THREE.Mesh(wheelAxisGeom,wheelAxisMat);
	wheelTireR.add(wheelAxis);

	mesh.add(wheelTireR);

	var wheelProtecL = wheelProtecR.clone();
	wheelProtecL.position.z = -wheelProtecR.position.z ;
	mesh.add(wheelProtecL);

	var wheelTireL = wheelTireR.clone();
	wheelTireL.position.z = -wheelTireR.position.z;
	mesh.add(wheelTireL);

	var wheelTireB = wheelTireR.clone();
	wheelTireB.scale.set(.5,.5,.5);
	//Ð¿Ð¾Ð·Ð¸Ñ†Ð¸Ñ
	wheelTireB.position.set(-35,-5,0);
	mesh.add(wheelTireB);

	var suspensionGeom = new THREE.BoxGeometry(4,20,4);
	suspensionGeom.applyMatrix4(new THREE.Matrix4().makeTranslation(0,10,0))
	var suspensionMat = new THREE.MeshPhongMaterial({color:Colors.red, flatShading:true,});
	var suspension = new THREE.Mesh(suspensionGeom,suspensionMat);
	suspension.position.set(-35,-5,0);
	suspension.rotation.z = -.3;
	mesh.add(suspension)

	const pilot = new RobotPilot()
	pilot.mesh.position.set(5,27,0)
	mesh.add(pilot.mesh)

	mesh.castShadow = true
	mesh.receiveShadow = true

	return [mesh, propeller, pilot]
}





const utils = {
	normalize: function (v, vmin, vmax, tmin, tmax) {
		var nv = Math.max(Math.min(v,vmax), vmin)
		var dv = vmax-vmin
		var pc = (nv-vmin)/dv
		var dt = tmax-tmin
		var tv = tmin + (pc*dt)
		return tv
	},

	findWhere: function (list, properties) {
		for (const elem of list) {
			let all = true
			for (const key in properties) {
				if (elem[key] !== properties[key]) {
					all = false
					break
				}
			}
			if (all) {
				return elem
			}
		}
		return null
	},

	randomOneOf: function (choices) {
		return choices[Math.floor(Math.random() * choices.length)]
	},

	randomFromRange: function (min, max) {
		return min + Math.random() * (max - min)
	},

	collide: function (mesh1, mesh2, tolerance) {
		const diffPos = mesh1.position.clone().sub(mesh2.position.clone())
		const d = diffPos.length()
		return d < tolerance
	},

	makeTetrahedron: function (a, b, c, d) {
		return [
			a[0], a[1], a[2],
			b[0], b[1], b[2],
			c[0], c[1], c[2],
			b[0], b[1], b[2],
			c[0], c[1], c[2],
			d[0], d[1], d[2],
		]
	}
}











class SceneManager {
	constructor() {
		this.list = new Set()
	}

	add(obj) {
		scene.add(obj.mesh)
		this.list.add(obj)
	}

	remove(obj) {
		scene.remove(obj.mesh)
		this.list.delete(obj)
	}

	clear() {
		for (const entry of this.list) {
			this.remove(entry)
		}
	}

	tick(deltaTime) {
		for (const entry of this.list) {
			if (entry.tick) {
				entry.tick(deltaTime)
			}
		}
	}
}

const sceneManager = new SceneManager()




class LoadingProgressManager {
	constructor() {
		this.promises = []
	}

	add(promise) {
		this.promises.push(promise)
	}

	then(callback) {
		return Promise.all(this.promises).then(callback)
	}

	catch(callback) {
		return Promise.all(this.promises).catch(callback)
	}
}

const loadingProgressManager = new LoadingProgressManager()




class AudioManager {
	constructor() {
		this.buffers = {}
		this.loader = new THREE.AudioLoader()
		this.listener = new THREE.AudioListener()
		this.categories = {}
	}

	setCamera(camera) {
		camera.add(this.listener)
	}

	load(soundId, category, path) {
		const promise = new Promise((resolve, reject) => {
			this.loader.load(path,
				(audioBuffer) => {
					this.buffers[soundId] = audioBuffer
					if (category !== null) {
						if (!this.categories[category]) {
							this.categories[category] = []
						}
						this.categories[category].push(soundId)
					}
					resolve()
				},
				() => {},
				reject
			)
		})
		loadingProgressManager.add(promise)
	}

	play(soundIdOrCategory, options) {
		options = options || {}

		let soundId = soundIdOrCategory
		const category = this.categories[soundIdOrCategory]
		if (category) {
			soundId = utils.randomOneOf(category)
		}

		const buffer = this.buffers[soundId]
		const sound = new THREE.Audio(this.listener)
		sound.setBuffer(buffer)
		if (options.loop) {
			sound.setLoop(true)
		}
		if (options.volume) {
			sound.setVolume(options.volume)
		}
		sound.play()
	}
}

const audioManager = new AudioManager()




class ModelManager {
	constructor(path) {
		this.path = path
		this.models = {}
	}

	load(modelName) {
		const promise = new Promise((resolve, reject) => {
			const loader = new THREE.OBJLoader()
			loader.load(this.path+'/'+modelName+'.obj', (obj) => {
				this.models[modelName] = obj
				resolve()
			}, function() {}, reject)
		})
		loadingProgressManager.add(promise)
	}

	get(modelName) {
		if (typeof this.models[modelName] === 'undefined') {
			throw new Error("Can't find model "+modelName)
		}
		return this.models[modelName]
	}
}

const modelManager = new ModelManager('/models')








var Colors = {
	red: 0xf25346,
	orange: 0xffa500,
	white: 0xd8d0d1,
	brown: 0x59332e,
	brownDark: 0x23190f,
	pink: 0xF5986E,
	yellow: 0xf4ce93,
	blue: 0x68c3c0,
}

const COLOR_COINS = 0xFFD700 // 0x009999
const COLOR_COLLECTIBLE_BUBBLE = COLOR_COINS



///////////////
// GAME VARIABLES
var canDie = true
var world, game
var newTime = new Date().getTime()
var oldTime = new Date().getTime()




let scene, camera, renderer


//SCREEN & MOUSE VARIABLES
var MAX_WORLD_X=1000




//INIT THREE JS, SCREEN AND MOUSE EVENTS
function createScene() {
	scene = new THREE.Scene()
	camera = new THREE.PerspectiveCamera(50, ui.width/ui.height, 0.1, 10000)
	audioManager.setCamera(camera)

	// fog 초기 설정
	scene.fog = new THREE.Fog(0xf7d9aa, 100, 950) // 원래 값 950(더 카메라 가까이 이동시킴)

	renderer = new THREE.WebGLRenderer({canvas: ui.canvas, alpha: true, antialias: true})
	renderer.setSize(ui.width, ui.height)
	renderer.setPixelRatio(window.devicePixelRatio? window.devicePixelRatio : 1)

	renderer.shadowMap.enabled = true


	function setupCamera() {
		renderer.setSize(ui.width, ui.height)
		camera.aspect = ui.width / ui.height
		camera.updateProjectionMatrix()
	}

	setupCamera()
	ui.onResize(setupCamera)

	// 공기오염을 표현하기 위한 Pollution Overlay Plane 추가
	pollutionOverlay = new THREE.Mesh(
		new THREE.PlaneGeometry(10000, 10000),
		new THREE.MeshBasicMaterial({
			color: 0x888888,      // 회색
			transparent: true,
			opacity: 0.0,         // 처음엔 투명
			depthWrite: false     // 다른 오브젝트 가리지 않음
		})
	);
	pollutionOverlay.position.z = -500;     // 카메라 앞쪽
	camera.add(pollutionOverlay);        // 카메라에 붙이기
	scene.add(camera);                   // 카메라 자체도 scene에 등록 필요

}




// LIGHTS
var ambientLight

function createLights() {
	const hemisphereLight = new THREE.HemisphereLight(0xaaaaaa,0x000000, .9)
	ambientLight = new THREE.AmbientLight(0xdc8874, .5)
	const shadowLight = new THREE.DirectionalLight(0xffffff, .9)
	shadowLight.position.set(150, 350, 350)
	shadowLight.castShadow = true
	shadowLight.shadow.camera.left = -400
	shadowLight.shadow.camera.right = 400
	shadowLight.shadow.camera.top = 400
	shadowLight.shadow.camera.bottom = -400
	shadowLight.shadow.camera.near = 1
	shadowLight.shadow.camera.far = 1000
	shadowLight.shadow.mapSize.width = 4096
	shadowLight.shadow.mapSize.height = 4096

	scene.add(hemisphereLight)
	scene.add(shadowLight)
	scene.add(ambientLight)
}




var RobotPilot = function(){
  this.mesh = new THREE.Object3D();
  this.mesh.name = "robot";

  // 몸통(Body)
  var bodyGeom = new THREE.BoxGeometry(16, 18, 8);
  var bodyMat = new THREE.MeshPhongMaterial({ color: 0x82d2f5, shininess: 50, specular: 0x99eaff });
  var body = new THREE.Mesh(bodyGeom, bodyMat);
  body.position.set(0, 0, 0);
  this.mesh.add(body);

  // 머리(Head)
  var headGeom = new THREE.BoxGeometry(11, 11, 11);
  var headMat = new THREE.MeshPhongMaterial({ color: 0xa1e3ff, shininess: 80, specular: 0xbfdfff });
  var head = new THREE.Mesh(headGeom, headMat);
  head.position.set(0, 14, 0);
  this.mesh.add(head);

  // 눈(Eyes, LED)
  var eyeGeom = new THREE.CylinderGeometry(1.2, 1.2, 1, 32);
  var eyeMat = new THREE.MeshPhongMaterial({ color: 0xff3030, shininess: 100, emissive: 0xff2222 });
  var eyeL = new THREE.Mesh(eyeGeom, eyeMat);
  var eyeR = eyeL.clone();
  eyeL.position.set(-3, 15, 5.5);
  eyeR.position.set(3, 15, 5.5);
  eyeL.rotation.x = Math.PI / 2;
  eyeR.rotation.x = Math.PI / 2;
  this.mesh.add(eyeL); this.mesh.add(eyeR);

  // 입(Mouth)
  var mouthGeom = new THREE.BoxGeometry(5, 1, 1);
  var mouthMat = new THREE.MeshPhongMaterial({ color: 0xffa800 });
  var mouth = new THREE.Mesh(mouthGeom, mouthMat);
  mouth.position.set(0, 11.5, 5.6);
  this.mesh.add(mouth);

  // 안테나(Antenna)
  var antennaGeom = new THREE.CylinderGeometry(0.5, 0.5, 7, 8);
  var antennaMat = new THREE.MeshPhongMaterial({ color: 0xe60026 });
  var antenna = new THREE.Mesh(antennaGeom, antennaMat);
  antenna.position.set(0, 20, 0);
  var antennaTopGeom = new THREE.SphereGeometry(1.3, 16, 16);
  var antennaTopMat = new THREE.MeshPhongMaterial({ color: 0xff3030, emissive: 0xff5050 });
  var antennaTop = new THREE.Mesh(antennaTopGeom, antennaTopMat);
  antennaTop.position.set(0, 3.5, 0);
  antenna.add(antennaTop);
  this.mesh.add(antenna);

  // 팔(Arms)
  var armMat = new THREE.MeshPhongMaterial({ color: 0xdeeefd });
  var upperArmGeom = new THREE.CylinderGeometry(1.5, 1.5, 8, 16);
  var lowerArmGeom = new THREE.CylinderGeometry(1.2, 1.2, 6, 16);

  // 왼팔(Left Arm)
  var armL = new THREE.Mesh(upperArmGeom, armMat);
  armL.position.set(-11, 5, 0);
  armL.rotation.z = Math.PI / 5;
  var armJointL = new THREE.Mesh(lowerArmGeom, armMat);
  armJointL.position.set(-14.2, 0, 0);
  armJointL.rotation.z = -Math.PI / 7;
  armL.add(armJointL);

  // 집게(Claw)
  var clawGeom = new THREE.TorusGeometry(2, 0.5, 8, 16, Math.PI);
  var clawMat = new THREE.MeshPhongMaterial({ color: 0xe60026, shininess: 30 });
  var clawL = new THREE.Mesh(clawGeom, clawMat);
  clawL.position.set(-4.2, 0, 0);
  clawL.rotation.y = Math.PI / 2;
  armJointL.add(clawL);

  // 오른팔(Right Arm)
  var armR = armL.clone();
  armR.position.set(11, 5, 0);
  armR.rotation.z = -Math.PI / 5;
  this.mesh.add(armL); this.mesh.add(armR);

  // 다리(Legs)
  var legMat = new THREE.MeshPhongMaterial({ color: 0x3c6e91 });
  var legGeom = new THREE.CylinderGeometry(1.8, 1.8, 14, 16);
  var legL = new THREE.Mesh(legGeom, legMat);
  var legR = legL.clone();
  legL.position.set(-4, -14, 0);
  legR.position.set(4, -14, 0);

  // 발(Foot)
  var footGeom = new THREE.BoxGeometry(4, 2, 6);
  var footMat = new THREE.MeshPhongMaterial({ color: 0x66b2ff });
  var footL = new THREE.Mesh(footGeom, footMat);
  var footR = footL.clone();
  footL.position.set(0, -8, 2);
  footR.position.set(0, -8, 2);
  legL.add(footL);
  legR.add(footR);
  this.mesh.add(legL); this.mesh.add(legR);

  // 패널(Body Panel/장식)
  var panelGeom = new THREE.BoxGeometry(10, 7, 0.6);
  var panelMat = new THREE.MeshPhongMaterial({ color: 0xb2e4ff });
  var panel = new THREE.Mesh(panelGeom, panelMat);
  panel.position.set(0, 0, 4.5);
  this.mesh.add(panel);

  // 패널 안의 버튼, 디테일
  var btnGeom = new THREE.BoxGeometry(1.2, 1.2, 0.6);
  var btnRed = new THREE.Mesh(btnGeom, new THREE.MeshPhongMaterial({ color: 0xff3030 }));
  btnRed.position.set(-2, 0.5, 0.4);
  var btnBlue = btnRed.clone();
  btnBlue.material = new THREE.MeshPhongMaterial({ color: 0x178fff });
  btnBlue.position.set(2, 0.5, 0.4);
  var barGeom = new THREE.BoxGeometry(0.5, 3, 0.6);
  var bar = new THREE.Mesh(barGeom, new THREE.MeshPhongMaterial({ color: 0xffa800 }));
  bar.position.set(3.5, -1, 0.4);

  // 심장 모니터(간단선)
  var monitorGeom = new THREE.PlaneGeometry(3, 1.2);
  var monitorMat = new THREE.MeshBasicMaterial({ color: 0x0be441 });
  var monitor = new THREE.Mesh(monitorGeom, monitorMat);
  monitor.position.set(-2, -2, 0.6);

  panel.add(btnRed); panel.add(btnBlue); panel.add(bar); panel.add(monitor);

  // 패널을 몸통 앞에 add
  this.mesh.add(panel);

  // (필수!) y축 정면을 카메라(y축) 쪽으로!
  this.mesh.rotation.y = Math.PI / 3;
};

// 로봇은 머리카락 흔들 효과 없음! (updateHairs 필요 없음)






// GUNS
class SimpleGun {
	constructor() {
		this.mesh = SimpleGun.createMesh()
		this.mesh.position.z = 28
		this.mesh.position.x = 25
		this.mesh.position.y = -8
	}

	static createMesh() {
		const metalMaterial = new THREE.MeshStandardMaterial({color: 0x222222, flatShading: true, roughness: 0.5, metalness: 1.0})
		const BODY_RADIUS = 3
		const BODY_LENGTH = 20
		const full = new THREE.Group()
		const body = new THREE.Mesh(
			new THREE.CylinderGeometry(BODY_RADIUS, BODY_RADIUS, BODY_LENGTH),
			metalMaterial,
		)
		body.rotation.z = Math.PI/2
		full.add(body)

		const barrel = new THREE.Mesh(
			new THREE.CylinderGeometry(BODY_RADIUS/2, BODY_RADIUS/2, BODY_LENGTH),
			metalMaterial,
		)
		barrel.rotation.z = Math.PI/2
		barrel.position.x = BODY_LENGTH
		full.add(barrel)
		return full
	}

	downtime() {
		return 0.1
	}

	damage() {
		return 1
	}

	shoot(direction) {
		const BULLET_SPEED = 0.5
		const RECOIL_DISTANCE = 4
		const RECOIL_DURATION = this.downtime() / 1.5

		const position = new THREE.Vector3()
		this.mesh.getWorldPosition(position)
		position.add(new THREE.Vector3(5, 0, 0))
		spawnProjectile(this.damage(), position, direction, BULLET_SPEED, 0.3, 3)

		// Little explosion at exhaust
		spawnParticles(position.clone().add(new THREE.Vector3(2,0,0)), 1, Colors.orange, 0.2)

		// audio
		audioManager.play('shot-soft')

		// Recoil of gun
		const initialX = this.mesh.position.x
		TweenMax.to(this.mesh.position, {
			duration: RECOIL_DURATION/2,
			x: initialX - RECOIL_DISTANCE,
			onComplete: () => {
				TweenMax.to(this.mesh.position, {
					duration: RECOIL_DURATION/2,
					x: initialX,
				})
			},
		})
	}
}




class DoubleGun {
	constructor() {
		this.gun1 = new SimpleGun()
		this.gun2 = new SimpleGun()
		this.gun2.mesh.position.add(new THREE.Vector3(0, 14, 0))
		this.mesh = new THREE.Group()
		this.mesh.add(this.gun1.mesh)
		this.mesh.add(this.gun2.mesh)
	}

	downtime() {
		return 0.15
	}

	damage() {
		return this.gun1.damage() + this.gun2.damage()
	}

	shoot(direction) {
		this.gun1.shoot(direction)
		this.gun2.shoot(direction)
	}
}




class BetterGun {
	constructor() {
		this.mesh = BetterGun.createMesh()
		this.mesh.position.z = 28
		this.mesh.position.x = -3
		this.mesh.position.y = -5
	}

	static createMesh() {
		const metalMaterial = new THREE.MeshStandardMaterial({color: 0x222222, flatShading: true, roughness: 0.5, metalness: 1.0})
		const BODY_RADIUS = 5
		const BODY_LENGTH = 30
		const full = new THREE.Group()
		const body = new THREE.Mesh(
			new THREE.CylinderGeometry(BODY_RADIUS, BODY_RADIUS, BODY_LENGTH),
			metalMaterial,
		)
		body.rotation.z = Math.PI/2
		body.position.x = BODY_LENGTH/2
		full.add(body)

		const BARREL_RADIUS = BODY_RADIUS/2
		const BARREL_LENGTH = BODY_LENGTH * 0.66
		const barrel = new THREE.Mesh(
			new THREE.CylinderGeometry(BARREL_RADIUS, BARREL_RADIUS, BARREL_LENGTH),
			metalMaterial,
		)
		barrel.rotation.z = Math.PI/2
		barrel.position.x = BODY_LENGTH + BARREL_LENGTH/2
		full.add(barrel)

		const TIP_RADIUS = BARREL_RADIUS * 1.3
		const TIP_LENGTH = BODY_LENGTH/4
		const tip = new THREE.Mesh(
			new THREE.CylinderGeometry(TIP_RADIUS, TIP_RADIUS, TIP_LENGTH),
			metalMaterial,
		)
		tip.rotation.z = Math.PI/2
		tip.position.x = BODY_LENGTH + BARREL_LENGTH + TIP_LENGTH/2
		full.add(tip)
		return full
	}

	downtime() {
		return 0.1
	}

	damage() {
		return 5
	}

	shoot(direction) {
		const BULLET_SPEED = 0.5
		const RECOIL_DISTANCE = 4
		const RECOIL_DURATION = this.downtime() / 3

		// position = position.clone().add(new THREE.Vector3(11.5, -1.3, 7.5))
		const position = new THREE.Vector3()
		this.mesh.getWorldPosition(position)
		position.add(new THREE.Vector3(12, 0, 0))
		spawnProjectile(this.damage(), position, direction, BULLET_SPEED, 0.8, 6)

		// Little explosion at exhaust
		spawnParticles(position.clone().add(new THREE.Vector3(2,0,0)), 3, Colors.orange, 0.5)

		// audio
		audioManager.play('shot-hard')

		// Recoil of gun
		const initialX = this.mesh.position.x
		TweenMax.to(this.mesh.position, {
			duration: RECOIL_DURATION,
			x: initialX - RECOIL_DISTANCE,
			onComplete: () => {
				TweenMax.to(this.mesh.position, {
					duration: RECOIL_DURATION,
					x: initialX,
				})
			},
		})
	}
}




class Airplane {
	constructor() {
		const [mesh, propeller, pilot] = createAirplaneMesh()
		this.mesh = mesh
		this.propeller = propeller
		this.pilot = pilot
		this.weapon = null
		this.lastShot = 0
	}


	equipWeapon(weapon) {
		if (this.weapon) {
			this.mesh.remove(this.weapon.mesh)
		}
		this.weapon = weapon
		if (this.weapon) {
			this.mesh.add(this.weapon.mesh)
		}
	}


	shoot() {
		if (!this.weapon) {
			return
		}

		// rate-limit the shooting
		const nowTime = new Date().getTime() / 1000
		const ready = nowTime-this.lastShot > this.weapon.downtime()
		if (!ready) {
			return
		}
		this.lastShot = nowTime

		// fire the shot
		let direction = new THREE.Vector3(10, 0, 0)
		direction.applyEuler(airplane.mesh.rotation)
		this.weapon.shoot(direction)

		// recoil airplane
		const recoilForce = this.weapon.damage()
		TweenMax.to(this.mesh.position, {
			duration: 0.05,
			x: this.mesh.position.x - recoilForce,
		})
	}


	tick(deltaTime) {
		this.propeller.rotation.x += 0.2 + game.planeSpeed * deltaTime*.005

		if (game.status === 'playing') {
			game.planeSpeed = utils.normalize(ui.mousePos.x, -0.5, 0.5, world.planeMinSpeed, world.planeMaxSpeed)
			let targetX = utils.normalize(ui.mousePos.x, -1, 1, -world.planeAmpWidth*0.7, -world.planeAmpWidth)
			let targetY = utils.normalize(ui.mousePos.y, -0.75, 0.75, world.planeDefaultHeight-world.planeAmpHeight, world.planeDefaultHeight+world.planeAmpHeight)

			game.planeCollisionDisplacementX += game.planeCollisionSpeedX
			targetX += game.planeCollisionDisplacementX

			game.planeCollisionDisplacementY += game.planeCollisionSpeedY
			targetY += game.planeCollisionDisplacementY

			this.mesh.position.x += (targetX - this.mesh.position.x) * deltaTime * world.planeMoveSensivity
			this.mesh.position.y += (targetY - this.mesh.position.y) * deltaTime * world.planeMoveSensivity

			this.mesh.rotation.x = (this.mesh.position.y - targetY) * deltaTime * world.planeRotZSensivity
			this.mesh.rotation.z = (targetY - this.mesh.position.y) * deltaTime * world.planeRotXSensivity

			//연기 효과 추가(배경)
			spawnBackgroundSmoke(deltaTime);

			if (game.fpv) {
				camera.position.y = this.mesh.position.y + 20
				// camera.setRotationFromEuler(new THREE.Euler(-1.490248, -1.4124514, -1.48923231))
				// camera.updateProjectionMatrix ()
			} else {
				camera.fov = utils.normalize(ui.mousePos.x, -30, 1, 40, 80)
				camera.updateProjectionMatrix()
				camera.position.y += (this.mesh.position.y - camera.position.y) * deltaTime * world.cameraSensivity
			}
		}

		game.planeCollisionSpeedX += (0-game.planeCollisionSpeedX)*deltaTime * 0.03;
		game.planeCollisionDisplacementX += (0-game.planeCollisionDisplacementX)*deltaTime *0.01;
		game.planeCollisionSpeedY += (0-game.planeCollisionSpeedY)*deltaTime * 0.03;
		game.planeCollisionDisplacementY += (0-game.planeCollisionDisplacementY)*deltaTime *0.01;

	}


	gethit(position) {
		const diffPos = this.mesh.position.clone().sub(position)
		const d = diffPos.length()
		game.planeCollisionSpeedX = 100 * diffPos.x / d
		game.planeCollisionSpeedY = 100 * diffPos.y / d
		ambientLight.intensity = 2
		audioManager.play('airplane-crash')
	}
}




function rotateAroundSea(object, deltaTime, speed) {
	object.angle += deltaTime * game.speed * world.collectiblesSpeed
	if (object.angle > Math.PI*2) {
		object.angle -= Math.PI*2
	}
	object.mesh.position.x = Math.cos(object.angle) * object.distance
	object.mesh.position.y = -world.seaRadius + Math.sin(object.angle) * object.distance
}




class Collectible {
	constructor(mesh, onApply) {
		this.angle = 0
		this.distance = 0
		this.onApply = onApply

		this.mesh = new THREE.Object3D()
		const bubble = new THREE.Mesh(
			new THREE.SphereGeometry(10, 100, 100),
			new THREE.MeshPhongMaterial({
				color: COLOR_COLLECTIBLE_BUBBLE,
				transparent: true,
				opacity: .4,
				flatShading: true,
			})
		)
		this.mesh.add(bubble)
		this.mesh.add(mesh)
		this.mesh.castShadow = true

		// for the angle:
		//   Math.PI*2 * 0.0  => on the right side of the sea cylinder
		//   Math.PI*2 * 0.1  => on the top right
		//   Math.PI*2 * 0.2  => directly in front of the plane
		//   Math.PI*2 * 0.3  => directly behind the plane
		//   Math.PI*2 * 0.4  => on the top left
		//   Math.PI*2 * 0.5  => on the left side
		this.angle = Math.PI*2 * 0.1
		this.distance = world.seaRadius + world.planeDefaultHeight + (-1 + 2*Math.random()) * (world.planeAmpHeight-20)
		this.mesh.position.y = -world.seaRadius + Math.sin(this.angle) * this.distance
		this.mesh.position.x = Math.cos(this.angle) * this.distance

		sceneManager.add(this)
	}


	tick(deltaTime) {
		rotateAroundSea(this, deltaTime, world.collectiblesSpeed)

		// rotate collectible for visual effect
		this.mesh.rotation.y += deltaTime * 0.002 * Math.random()
		this.mesh.rotation.z += deltaTime * 0.002 * Math.random()

		// collision?
		if (utils.collide(airplane.mesh, this.mesh, world.collectibleDistanceTolerance)) {
			this.onApply()
			this.explode()
		}
		// passed-by?
		else if (this.angle > Math.PI) {
			sceneManager.remove(this)
		}
	}


	explode() {
		spawnParticles(this.mesh.position.clone(), 15, COLOR_COLLECTIBLE_BUBBLE, 3)
		sceneManager.remove(this)
		audioManager.play('bubble')

		const DURATION = 1

		setTimeout(() => {
			const itemMesh = new THREE.Group()
			for (let i=1; i<this.mesh.children.length; i+=1) {
				itemMesh.add(this.mesh.children[i])
			}
			scene.add(itemMesh)
			itemMesh.position.y = 120
			itemMesh.position.z = 50

			const initialScale = itemMesh.scale.clone()
			TweenMax.to(itemMesh.scale, {
				duration: DURATION / 2,
				x: initialScale.x * 4,
				y: initialScale.y * 4,
				z: initialScale.z * 4,
				ease: 'Power2.easeInOut',
				onComplete: () => {
					TweenMax.to(itemMesh.scale, {
						duration: DURATION / 2,
						x: 0,
						y: 0,
						z: 0,
						ease: 'Power2.easeInOut',
						onComplete: () => {
							scene.remove(itemMesh)
						},
					})
				},
			})
		}, 200)
	}
}


function spawnSimpleGunCollectible() {
	const gun = SimpleGun.createMesh()
	gun.scale.set(0.25, 0.25, 0.25)
	gun.position.x = -2

	new Collectible(gun, () => {
		airplane.equipWeapon(new SimpleGun())
	})
}


function spawnBetterGunCollectible() {
	const gun = BetterGun.createMesh()
	gun.scale.set(0.25, 0.25, 0.25)
	gun.position.x = -7

	new Collectible(gun, () => {
		airplane.equipWeapon(new BetterGun())
	})
}


function spawnDoubleGunCollectible() {
	const guns = new THREE.Group()

	const gun1 = SimpleGun.createMesh()
	gun1.scale.set(0.25, 0.25, 0.25)
	gun1.position.x = -2
	gun1.position.y = -2
	guns.add(gun1)

	const gun2 = SimpleGun.createMesh()
	gun2.scale.set(0.25, 0.25, 0.25)
	gun2.position.x = -2
	gun2.position.y = 2
	guns.add(gun2)

	new Collectible(guns, () => {
		airplane.equipWeapon(new DoubleGun())
	})
}


function spawnLifeCollectible() {
	const heart = modelManager.get('heart')
	heart.traverse(function (child) {
		if (child instanceof THREE.Mesh) {
			child.material.color.setHex(0xFF0000)
		}
	})
	heart.position.set(0, -1, -3)
	heart.scale.set(5, 5, 5)

	new Collectible(heart, () => {
		addLife()
	})
}






class Cloud {
	constructor() {
		this.mesh = new THREE.Object3D()
		const geom = new THREE.BoxGeometry(20, 20, 20)
		const mat = new THREE.MeshPhongMaterial({
			color: Colors.white,
		})
		const nBlocs = 3+Math.floor(Math.random()*3)
		for (let i=0; i<nBlocs; i++) {
			const m = new THREE.Mesh(geom.clone(), mat)
			m.position.x = i*15
			m.position.y = Math.random()*10
			m.position.z = Math.random()*10
			m.rotation.y = Math.random()*Math.PI*2
			m.rotation.z = Math.random()*Math.PI*2
			const s = 0.1 + Math.random()*0.9
			m.scale.set(s, s, s)
			this.mesh.add(m)
			m.castShadow = true
			m.receiveShadow = true

		}
	}

	tick(deltaTime) {
		const l = this.mesh.children.length
		for(let i=0; i<l; i++) {
			let m = this.mesh.children[i]
			m.rotation.y += Math.random() * 0.002*(i+1)
			m.rotation.z += Math.random() * 0.005*(i+1)
		}
	}
}




class Sky {
	constructor() {
		this.mesh = new THREE.Object3D()
		this.nClouds = 20
		this.clouds = []
		const stepAngle = Math.PI*2 / this.nClouds
		for (let i=0; i<this.nClouds; i++) {
			const c = new Cloud()
			this.clouds.push(c)
			var a = stepAngle * i
			var h = world.seaRadius + 150 + Math.random()*200
			c.mesh.position.y = Math.sin(a)*h
			c.mesh.position.x = Math.cos(a)*h
			c.mesh.position.z = -300 - Math.random()*500
			c.mesh.rotation.z = a + Math.PI/2
			const scale = 1+Math.random()*2
			c.mesh.scale.set(scale, scale, scale)
			this.mesh.add(c.mesh)
		}
	}

	tick(deltaTime) {
		for(var i=0; i<this.nClouds; i++) {
			var c = this.clouds[i]
			c.tick(deltaTime)
		}
		this.mesh.rotation.z += game.speed * deltaTime
	}
}




const COLOR_SEA_LEVEL = [
	0x68c3c0,  // hsl(178deg 43% 59%)
	0x47b3af,  // hsl(178deg 43% 49%)
	0x398e8b,  // hsl(178deg 43% 39%)
	0x2a6a68,  // hsl(178deg 43% 29%)
	0x1c4544,  // hsl(178deg 43% 19%)
	0x0d2120,  // hsl(178deg 43% 09%)
]


class Sea {
	constructor() {
		var geom = new THREE.CylinderGeometry(world.seaRadius, world.seaRadius, world.seaLength, 40, 10)
		geom.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI/2))
		this.waves = [];
		const arr = geom.attributes.position.array
		for (let i=0; i<arr.length/3; i++) {
			this.waves.push({
				x: arr[i*3+0],
				y: arr[i*3+1],
				z: arr[i*3+2],
				ang: Math.random()*Math.PI*2,
				amp: world.wavesMinAmp + Math.random()*(world.wavesMaxAmp-world.wavesMinAmp),
				speed: world.wavesMinSpeed + Math.random()*(world.wavesMaxSpeed - world.wavesMinSpeed)
			})
		}
		var mat = new THREE.MeshPhongMaterial({
			color: COLOR_SEA_LEVEL[0],
			transparent: true,
			opacity: 0.8,
			flatShading: true,
		})
		this.mesh = new THREE.Mesh(geom, mat)
		this.mesh.receiveShadow = true
	}

	tick(deltaTime) {
		var arr = this.mesh.geometry.attributes.position.array
		for (let i=0; i<arr.length/3; i++) {
			var wave = this.waves[i]
			arr[i*3+0] = wave.x + Math.cos(wave.ang) * wave.amp
			arr[i*3+1] = wave.y + Math.sin(wave.ang) * wave.amp
			wave.ang += wave.speed * deltaTime
		}
		this.mesh.geometry.attributes.position.needsUpdate = true
	}

	updateColor() {
		this.mesh.material = new THREE.MeshPhongMaterial({
			color: COLOR_SEA_LEVEL[(game.level - 1) % COLOR_SEA_LEVEL.length],
			transparent: true,
			opacity: .8,
			flatShading: true,
		})
	}
}






function spawnParticles(pos, count, color, scale) {
	for (let i=0; i<count; i++) {
		const geom = new THREE.TetrahedronGeometry(3, 0)
		const mat = new THREE.MeshPhongMaterial({
			color: 0x009999,
			shininess: 0,
			specular: 0xffffff,
			flatShading: true,
		})
		const mesh = new THREE.Mesh(geom, mat)
		scene.add(mesh)

		mesh.visible = true
		mesh.position.copy(pos)
		mesh.material.color = new THREE.Color(color)
		mesh.material.needsUpdate = true
		mesh.scale.set(scale, scale, scale)
		const targetX = pos.x + (-1 + Math.random()*2)*50
		const targetY = pos.y + (-1 + Math.random()*2)*50
		const targetZ = pos.z + (-1 + Math.random()*2)*50
		const speed = 0.6 + Math.random()*0.2
		TweenMax.to(mesh.rotation, speed, {x:Math.random()*12, y:Math.random()*12})
		TweenMax.to(mesh.scale, speed, {x:.1, y:.1, z:.1})
		TweenMax.to(mesh.position, speed, {x:targetX, y:targetY, z: targetZ, delay:Math.random() *.1, ease:Power2.easeOut, onComplete: () => {
			scene.remove(mesh)
		}})
	}
}



// ENEMIES
class Enemy {
	constructor() {
		var geom = new THREE.TetrahedronGeometry(8, 2)
		var mat = new THREE.MeshPhongMaterial({
			color: Colors.red,
			shininess: 0,
			specular: 0xffffff,
			flatShading: true,
		})
		this.mesh = new THREE.Mesh(geom, mat)
		this.mesh.castShadow = true
		this.angle = 0
		this.distance = 0
		this.hitpoints = 3
		sceneManager.add(this)
	}


	tick(deltaTime) {
		rotateAroundSea(this, deltaTime, world.enemiesSpeed)
		this.mesh.rotation.y += Math.random() * 0.1
		this.mesh.rotation.z += Math.random() * 0.1

		// collision?
		if (utils.collide(airplane.mesh, this.mesh, world.enemyDistanceTolerance) && game.status!=='finished') {
			this.explode()
			airplane.gethit(this.mesh.position)
			removeLife()
		}
		// passed-by?
		else if (this.angle > Math.PI) {
			sceneManager.remove(this)
		}

		const thisAabb = new THREE.Box3().setFromObject(this.mesh)
		for (const projectile of allProjectiles) {
			const projectileAabb = new THREE.Box3().setFromObject(projectile.mesh)
			if (thisAabb.intersectsBox(projectileAabb)) {
				spawnParticles(projectile.mesh.position.clone(), 5, Colors.brownDark, 1)
				projectile.remove()
				this.hitpoints -= projectile.damage
				audioManager.play('bullet-impact', {volume: 0.3})
			}
		}
		if (this.hitpoints <= 0) {
			this.explode()
		}
	}


	explode() {
		audioManager.play('rock-shatter', {volume: 3})
		spawnParticles(this.mesh.position.clone(), 15, Colors.red, 3)
		sceneManager.remove(this)
		game.statistics.enemiesKilled += 1
	}
}


function spawnEnemies(count) {
	for (let i=0; i<count; i++) {
		const enemy = new Enemy()
		enemy.angle = - (i*0.1)
		enemy.distance = world.seaRadius + world.planeDefaultHeight + (-1 + Math.random() * 2) * (world.planeAmpHeight-20)
		enemy.mesh.position.x = Math.cos(enemy.angle) * enemy.distance
		enemy.mesh.position.y = -world.seaRadius + Math.sin(enemy.angle)*enemy.distance
	}
	game.statistics.enemiesSpawned += count
}





// COINS
// === 코인 텍스처 함수 (칩/프레임) ===
function getTaskTexture(type) {
  const canvas = document.createElement('canvas');
  canvas.width = 150;
  canvas.height = 150;
  const ctx = canvas.getContext('2d');

  if (type === "gpu") {
    // 1. 초록색 네모 바탕
    ctx.fillStyle = "#7bef99";
    ctx.fillRect(0,0,150,150);

    // 2. 노란색 네모 테두리
    ctx.strokeStyle = "#ffe655";
    ctx.lineWidth = 8;
    ctx.strokeRect(16,16,96,96);

    // 3. 노란색 회로선 느낌 (칩 분위기)
    ctx.lineWidth = 3;
    ctx.beginPath();
    for(let i=0; i<4; i++) {
      // 위
      ctx.moveTo(32 + i*21, 16);
      ctx.lineTo(32 + i*21, 0);
      // 아래
      ctx.moveTo(32 + i*21, 112);
      ctx.lineTo(32 + i*21, 128);
      // 왼쪽
      ctx.moveTo(16, 32 + i*21);
      ctx.lineTo(0, 32 + i*21);
      // 오른쪽
      ctx.moveTo(112, 32 + i*21);
      ctx.lineTo(128, 32 + i*21);
    }
    ctx.stroke();

    // 4. GPU 글씨 (선택: 확실하게 구분하고 싶을 때만!)
    ctx.font = "bold 36px Arial";
    ctx.fillStyle = "#1b1c1d";
    ctx.fillText("GPU", 38, 85);

  } else if (type === "frame") {
    // (액자 코드는 기존대로)
    ctx.fillStyle = "#ffe472";
    ctx.fillRect(0,0,150,150);
    ctx.fillStyle = "#a5d9ff";
    ctx.fillRect(12,12,104,104);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 4;
    ctx.strokeRect(12,12,104,104);
    ctx.font = "bold 44px Arial";
    ctx.fillStyle="#fff";
    ctx.fillText("🌄", 35, 90);
    ctx.font = "bold 36px Arial";
    ctx.fillStyle = "#222";
    ctx.fillText("IMG", 60, 120);
    ctx.font = "bold 18px Arial";
    ctx.fillStyle = "#78b6ec";
    ctx.fillText("GEN", 86, 108);
  }
  return new THREE.CanvasTexture(canvas);
}

// === 자막 표시 함수 (하단 자막 DIV 필요!) ===
function showSubtitle(text, duration = 1400) {
  console.log('자막', text, duration); // 이 줄 추가
  const el = document.getElementById('gameSubtitle');
  if (!el) return;
  el.innerText = text;
  el.style.display = text ? 'block' : 'none';
  clearTimeout(el._subtitleTimeout);
  if (text) {
    el._subtitleTimeout = setTimeout(() => {
      el.style.display = 'none';
    }, duration);
  }
}


// === 묶음 추적 변수(전역, 또는 Game 객체 등에서 관리) ===
let currentBatch = {
  type: null,
  batchId: null,
  coinCount: 0,
  startTime: null,
  collected: 0,
  lastSubtitleTime: 0,
  coins: []
};
// === Coin 클래스(묶음 정보 전체 포함) ===
class Coin {
  constructor(batchInfo, type) {
    this.type = type || "gpu";
    this.batchInfo = batchInfo; // **묶음 객체 참조**

    // geometry/material - cylinder 유지 또는 네모로 바꿔도 됨
    let geom;
    if (this.type === "gpu") {
      // GPU 칩: 네모, 살짝 두꺼운 느낌
      geom = new THREE.BoxGeometry(7, 7, 1);
    } else if (this.type === "frame") {
      // 액자: 더 얇은 네모(액자 느낌)
      geom = new THREE.BoxGeometry(7, 7, 2);
    }
    let mat = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      shininess: 1,
      specular: 0xffffff,
      flatShading: true,
      map: getTaskTexture(this.type)
    });
    this.mesh = new THREE.Mesh(geom, mat);
    this.mesh.castShadow = true;
    this.angle = 0;
    this.dist = 0;
    sceneManager.add(this);
  }

  tick(deltaTime) {
    rotateAroundSea(this, deltaTime, world.coinsSpeed);

    this.mesh.rotation.z += Math.random() * 0.1;
    this.mesh.rotation.y += Math.random() * 0.1;

    // collision?
    if (utils.collide(airplane.mesh, this.mesh, world.coinDistanceTolerance)) {
      // === 묶음 소요시간 처리 ===
      if (this.batchInfo) {
        if (this.batchInfo.collected === 0) this.batchInfo.startTime = Date.now();
        this.batchInfo.collected++;
        let now = Date.now();
        let elapsedSec = ((now - this.batchInfo.startTime) / 30).toFixed(2);

        let subtitleText = "";
        if (this.type === "gpu") {
          subtitleText = `${elapsedSec}초 동안 생각함...`;
        } else if (this.type === "frame") {
          subtitleText = `이미지 생성 중... (${elapsedSec}초 경과)`;
        }
        // 100ms마다 갱신
        if (now - this.batchInfo.lastSubtitleTime > 100) {
          showSubtitle(subtitleText, 1800);
          this.batchInfo.lastSubtitleTime = now;
        }
        // 마지막 코인일 때
        if (this.batchInfo.collected >= this.batchInfo.coinCount) {
          showSubtitle(subtitleText, 1400);
          setTimeout(() => showSubtitle('', 10), 1400);
        }
      }

      // === 타입별 파티클 색상 ===
      let particleColor = (this.type === "gpu") ? 0x7bef99 : 0xffe472;
      spawnParticles(this.mesh.position.clone(), 5, particleColor, 0.8);
      addCoin();
      audioManager.play('coin', {volume: 0.5});
      sceneManager.remove(this);
    }
    // passed-by?
    else if (this.angle > Math.PI) {
      sceneManager.remove(this);
    }
  }
}

// === Coin 묶음 생성 함수 ===
function spawnCoins() {
  // === 묶음type, 개수 랜덤 생성 ===
  const types = ["gpu", "frame"];
  const type = types[Math.floor(Math.random() * types.length)];
  const batchId = 'b' + Date.now() + Math.floor(Math.random() * 1000);

  const nCoins = 1 + Math.floor(Math.random() * 10);
  const d = world.seaRadius + world.planeDefaultHeight + utils.randomFromRange(-1, 1) * (world.planeAmpHeight - 20);
  const amplitude = 10 + Math.round(Math.random() * 10);

  // === 묶음 객체 ===
  const batchInfo = {
    type,
    batchId,
    coinCount: nCoins,
    startTime: null,
    collected: 0,
    lastSubtitleTime: 0,
    coins: []
  };

  for (let i = 0; i < nCoins; i++) {
    const coin = new Coin(batchInfo, type);
    coin.angle = - (i * 0.02);
    coin.distance = d + Math.cos(i * 0.5) * amplitude;
    coin.mesh.position.y = -world.seaRadius + Math.sin(coin.angle) * coin.distance;
    coin.mesh.position.x = Math.cos(coin.angle) * coin.distance;
    batchInfo.coins.push(coin);
  }
  game.statistics.coinsSpawned += nCoins;
}


// SHOOTING
let allProjectiles = []


class Projectile {
	constructor(damage, initialPosition, direction, speed, radius, length) {
		const PROJECTILE_COLOR = Colors.brownDark  // 0x333333

		this.damage = damage
		this.mesh = new THREE.Mesh(
			new THREE.CylinderGeometry(radius, radius, length),
			new THREE.LineBasicMaterial({color: PROJECTILE_COLOR})
		)
		this.mesh.position.copy(initialPosition)
		this.mesh.rotation.z = Math.PI/2
		this.direction = direction.clone()
		this.direction.setLength(1)
		this.speed = speed
		sceneManager.add(this)

		game.statistics.shotsFired += 1
	}

	tick(deltaTime) {
		this.mesh.position.add(this.direction.clone().multiplyScalar(this.speed * deltaTime))
		this.mesh.position.z *= 0.9
		// out of screen? => remove
		if (this.mesh.position.x > MAX_WORLD_X) {
			this.remove()
		}
	}

	remove() {
		sceneManager.remove(this)
		allProjectiles.splice(allProjectiles.indexOf(this), 1)
	}
}


function spawnProjectile(damage, initialPosition, direction, speed, radius, length) {
	allProjectiles.push(new Projectile(damage, initialPosition, direction, speed, radius, length))
}




// 3D Models
let sea, sea2
let airplane


function createPlane() {
	airplane = new Airplane()
	airplane.mesh.scale.set(.25,.25,.25)
	airplane.mesh.position.y = world.planeDefaultHeight
	scene.add(airplane.mesh)
}


function createSea() {
	// We create a second sea that is not animated because the animation of our our normal sea leaves holes at certain points and I don't know how to get rid of them. These holes did not occur in the original script that used three js version 75 and mergeVertices. However, I tried to reproduce that behaviour in the animation function but without succes - thus this workaround here.
	sea = new Sea()
	sea.mesh.position.y = -world.seaRadius
	scene.add(sea.mesh)

	sea2 = new Sea()
	sea2.mesh.position.y = -world.seaRadius
	scene.add(sea2.mesh)
}


function createSky() {
	sky = new Sky()
	sky.mesh.position.y = -world.seaRadius
	scene.add(sky.mesh)
}



function loop() {
	newTime = new Date().getTime()
	const deltaTime = newTime - oldTime
	oldTime = newTime

	if (game.status == 'playing') {
		if (!game.paused) {
			// Add coins
			if (Math.floor(game.distance)%world.distanceForCoinsSpawn == 0 && Math.floor(game.distance) > game.coinLastSpawn) {
				game.coinLastSpawn = Math.floor(game.distance);
				spawnCoins()
			}
			if (Math.floor(game.distance)%world.distanceForSpeedUpdate == 0 && Math.floor(game.distance) > game.speedLastUpdate) {
				game.speedLastUpdate = Math.floor(game.distance);
				game.targetBaseSpeed += world.incrementSpeedByTime * deltaTime;
			}
			if (Math.floor(game.distance)%world.distanceForEnemiesSpawn == 0 && Math.floor(game.distance) > game.enemyLastSpawn) {
				game.enemyLastSpawn = Math.floor(game.distance)
				spawnEnemies(game.level)
			}
			if (Math.floor(game.distance)%world.distanceForLevelUpdate == 0 && Math.floor(game.distance) > game.levelLastUpdate) {
				game.levelLastUpdate = Math.floor(game.distance)
				game.level += 1
				// level이 오를때마다 => 시야거리를 100씩 줄여서 점점 뿌옇게 되는 공기질을 표현하고자 함(공기오염)
				// const newFogFar = Math.max(400, 300 - game.level * 50) // 최소 400까지(너무 깜깜해지는 것 방지차원)
				// scene.fog.far = newFogFar

				// 공기오염 overlay 관련 수치 조정
 				pollutionOverlay.material.opacity = Math.min(0.1 * game.level, 0.5);
  				console.log("Level", game.level, "→ opacity:", pollutionOverlay.material.opacity);

				if (game.level === world.levelCount) {
					game.status = 'finished'
					setFollowView()
					ui.showScoreScreen()
				} else {
					ui.informNextLevel(game.level)
					sea.updateColor()
					sea2.updateColor()
					ui.updateLevelCount()
					game.targetBaseSpeed = world.initSpeed + world.incrementSpeedByLevel*game.level
				}
			}

			// span collectibles
			if (game.lifes<world.maxLifes && (game.distance-game.lastLifeSpawn)>world.pauseLifeSpawn && Math.random()<0.01) {
				game.lastLifeSpawn = game.distance
				spawnLifeCollectible()
			}
			if (!game.spawnedSimpleGun && game.distance>world.simpleGunLevelDrop*world.distanceForLevelUpdate) {
				spawnSimpleGunCollectible()
				game.spawnedSimpleGun = true
			}
			if (!game.spawnedDoubleGun && game.distance>world.doubleGunLevelDrop*world.distanceForLevelUpdate) {
				spawnDoubleGunCollectible()
				game.spawnedDoubleGun = true
			}
			if (!game.spawnedBetterGun && game.distance>world.betterGunLevelDrop*world.distanceForLevelUpdate) {
				spawnBetterGunCollectible()
				game.spawnedBetterGun = true
			}

			if (ui.mouseButtons[0] || ui.keysDown['Space']) {
				airplane.shoot()
			}

			airplane.tick(deltaTime)
			game.distance += game.speed * deltaTime * world.ratioSpeedDistance
			game.baseSpeed += (game.targetBaseSpeed - game.baseSpeed) * deltaTime * 0.02
			game.speed = game.baseSpeed * game.planeSpeed
			// smoke 텍스쳐 추가 (비행기 객체에 추가하는 방법)
			// smokeManager.add(airplane.mesh.position.clone().add(new THREE.Vector3(-30, 0, 0)))
			// smokeManager.tick(deltaTime, game.level)
			spawnBackgroundSmoke(deltaTime); // 배경 전반에 연기 추가
			ui.updateDistanceDisplay()

			if (game.lifes<=0 && canDie) {
				game.status = "gameover"
			}
		}
	}
	else if (game.status == "gameover") {
		game.speed *= .99
		airplane.mesh.rotation.z += (-Math.PI/2 - airplane.mesh.rotation.z) * 0.0002 * deltaTime
		airplane.mesh.rotation.x += 0.0003 * deltaTime
		game.planeFallSpeed *= 1.05
		airplane.mesh.position.y -= game.planeFallSpeed * deltaTime
		
		// 경고용 메세지 관련 부분
		ambientLight.intensity = Math.max(0, ambientLight.intensity - 0.005 * deltaTime);
		pollutionOverlay.material.color.set(0x111111);
		pollutionOverlay.material.opacity = 0.8;
		document.getElementById('power-warning').style.display = 'block';
		document.getElementById('blackout-overlay').style.opacity = '0.7';

		if (airplane.mesh.position.y < -200) {
			ui.showReplay()
			game.status = "waitingReplay"
			audioManager.play('water-splash')
		}
	}
	else if (game.status == "waitingReplay"){
		// nothing to do
	}

	if (!game.paused) {
		airplane.tick(deltaTime)

		sea.mesh.rotation.z += game.speed*deltaTime
		if (sea.mesh.rotation.z > 2*Math.PI) {
			sea.mesh.rotation.z -= 2*Math.PI
		}
		ambientLight.intensity += (.5 - ambientLight.intensity) * deltaTime * 0.005

		sceneManager.tick(deltaTime)

		sky.tick(deltaTime)
		sea.tick(deltaTime)
	}

	renderer.render(scene, camera)
	requestAnimationFrame(loop)
}





// COINS
function addCoin() {
	game.coins += 1
	ui.updateCoinsCount(game.coins)

	game.statistics.coinsCollected += 1
}



function addLife() {
	game.lifes = Math.min(world.maxLifes, game.lifes+1)
	ui.updateLifesDisplay()
}

function removeLife() {
	game.lifes = Math.max(0, game.lifes-1)
	ui.updateLifesDisplay()

	game.statistics.lifesLost += 1
}




function setSideView() {
	game.fpv = false
	camera.position.set(0, world.planeDefaultHeight, 200)
	camera.setRotationFromEuler(new THREE.Euler(0, 0, 0))
}


function setFollowView() {
	game.fpv = true
	camera.position.set(-89, airplane.mesh.position.y+20, 0)
	camera.setRotationFromEuler(new THREE.Euler(-1.490248, -1.4124514, -1.48923231))
	camera.updateProjectionMatrix ()
}






class UI {
	constructor(onStart) {
		this._elemDistanceCounter = document.getElementById("distValue")
		this._elemReplayMessage = document.getElementById("replayMessage")
		this._elemLevelCounter = document.getElementById("levelValue")
		this._elemLevelCircle = document.getElementById("levelCircleStroke")
		this._elemsLifes = document.querySelectorAll('#lifes img')
		this._elemCoinsCount = document.getElementById('coinsValue')

		document.querySelector('#intro-screen button').onclick = () => {
			document.getElementById('intro-screen').classList.remove('visible')
			onStart()
		}

		document.addEventListener('keydown', this.handleKeyDown.bind(this), false)
		document.addEventListener('keyup', this.handleKeyUp.bind(this), false)
		document.addEventListener('mousedown', this.handleMouseDown.bind(this), false)
		document.addEventListener('mouseup', this.handleMouseUp.bind(this), false)
		document.addEventListener('mousemove', this.handleMouseMove.bind(this), false)
		document.addEventListener('blur', this.handleBlur.bind(this), false)

		document.oncontextmenu = document.body.oncontextmenu = function() {return false;}

		window.addEventListener('resize', this.handleWindowResize.bind(this), false)

		this.width = window.innerWidth
		this.height = window.innerHeight
		this.mousePos = {x: 0, y: 0}
		this.canvas = document.getElementById('threejs-canvas')

		this.mouseButtons = [false, false, false]
		this.keysDown = {}

		this._resizeListeners = []
	}


	onResize(callback) {
		this._resizeListeners.push(callback)
	}


	handleWindowResize(event) {
		this.width = window.innerWidth
		this.height = window.innerHeight

		for (const listener of this._resizeListeners) {
			listener()
		}
	}


	handleMouseMove(event) {
		var tx = -1 + (event.clientX / this.width)*2
		var ty = 1 - (event.clientY / this.height)*2
		this.mousePos = {x:tx, y:ty}
	}

	handleTouchMove(event) {
		event.preventDefault()
		var tx = -1 + (event.touches[0].pageX / this.width)*2
		var ty = 1 - (event.touches[0].pageY / this.height)*2
		this.mousePos = {x: tx, y: ty}
	}

	handleMouseDown(event) {
		this.mouseButtons[event.button] = true

		if (event.button===1 && game.status==='playing') {
			airplane.shoot()
		}
	}

	handleKeyDown(event) {
		this.keysDown[event.code] = true
		if (event.code === 'KeyP') {
			game.paused = !game.paused
		}
		if (event.code === 'Space') {
			airplane.shoot()
		}
		if (event.code === 'Enter') {
			if (game.fpv) {
				setSideView()
			} else {
				setFollowView()
			}
		}
	}

	handleKeyUp(event) {
		this.keysDown[event.code] = false
	}

	handleMouseUp(event) {
		this.mouseButtons[event.button] = false
		event.preventDefault()

		if (game && game.status == "waitingReplay") {
			resetMap()
			ui.informNextLevel(1)
			game.paused = false
			sea.updateColor()
			sea2.updateColor()

			ui.updateDistanceDisplay()
			ui.updateLevelCount()
			ui.updateLifesDisplay()
			ui.updateCoinsCount()

			ui.hideReplay()
		}
	}

	handleBlur(event) {
		this.mouseButtons = [false, false, false]
	}


	// function handleTouchEnd(event) {
	// 	if (game.status == "waitingReplay"){
	// 		resetGame()
	// 		ui.hideReplay()
	// 	}
	// }


	showReplay() {
		this._elemReplayMessage.style.display = 'block'
	}

	hideReplay() {
		this._elemReplayMessage.style.display = 'none'
	}


	updateLevelCount() {
		this._elemLevelCounter.innerText = game.level
	}

	updateCoinsCount() {
		this._elemCoinsCount.innerText = game.coins
	}

	updateDistanceDisplay() {
		this._elemDistanceCounter.innerText = Math.floor(game.distance)
		const d = 502 * (1-(game.distance%world.distanceForLevelUpdate) / world.distanceForLevelUpdate)
		this._elemLevelCircle.setAttribute("stroke-dashoffset", d)
	}

	updateLifesDisplay() {
		for (let i=0, len=this._elemsLifes.length; i<len; i+=1) {
			const hasThisLife = i < game.lifes
			const elem = this._elemsLifes[i]
			if (hasThisLife && !elem.classList.contains('visible')) {
				elem.classList.remove('invisible')
				elem.classList.add('visible')
			}
			else if (!hasThisLife && !elem.classList.contains('invisible')) {
				elem.classList.remove('visible')
				elem.classList.add('invisible')
			}
		}
	}


	informNextLevel(level) {
		const ANIMATION_DURATION = 1.0

		const elem = document.getElementById('new-level')
		elem.style.visibility = 'visible'
		elem.style.animationDuration = Math.round(ANIMATION_DURATION * 1000)+'ms'
		elem.children[1].innerText = level
		elem.classList.add('animating')
		setTimeout(() => {
			document.getElementById('new-level').style.visibility = 'hidden'
			elem.classList.remove('animating')
		}, 1000)
	}


	showScoreScreen() {
		const elemScreen = document.getElementById('score-screen')

		// make visible
		elemScreen.classList.add('visible')

		// fill in statistics
		document.getElementById('score-coins-collected').innerText = game.statistics.coinsCollected
		document.getElementById('score-coins-total').innerText = game.statistics.coinsSpawned
		document.getElementById('score-enemies-killed').innerText = game.statistics.enemiesKilled
		document.getElementById('score-enemies-total').innerText = game.statistics.enemiesSpawned
		document.getElementById('score-shots-fired').innerText = game.statistics.shotsFired
		document.getElementById('score-lifes-lost').innerText = game.statistics.lifesLost
	}


	showError(message) {
		document.getElementById('error').style.visibility = 'visible'
		document.getElementById('error-message').innerText = message
	}
}
let ui



function createWorld() {
	world = {
		initSpeed: 0.00035,
		incrementSpeedByTime: 0.0000025,
		incrementSpeedByLevel: 0.000005,
		distanceForSpeedUpdate: 100,
		ratioSpeedDistance: 50,

		simpleGunLevelDrop: 1.1,
		doubleGunLevelDrop: 2.3,
		betterGunLevelDrop: 3.5,

		maxLifes: 3,
		pauseLifeSpawn: 400,

		levelCount: 6,
		distanceForLevelUpdate: 100, 

		planeDefaultHeight: 100,
		planeAmpHeight: 80,
		planeAmpWidth: 75,
		planeMoveSensivity: 0.005,
		planeRotXSensivity: 0.0008,
		planeRotZSensivity: 0.0004,
		planeMinSpeed: 1.2,
		planeMaxSpeed: 1.6,

		seaRadius: 600,
		seaLength: 800,
		wavesMinAmp: 5,
		wavesMaxAmp: 20,
		wavesMinSpeed: 0.001,
		wavesMaxSpeed: 0.003,

		cameraSensivity: 0.002,

		coinDistanceTolerance: 15,
		coinsSpeed: 0.5,
		distanceForCoinsSpawn: 50,

		collectibleDistanceTolerance: 15,
		collectiblesSpeed: 0.6,

		enemyDistanceTolerance: 10,
		enemiesSpeed: 0.6,
		distanceForEnemiesSpawn: 50,
	}

	// create the world
	createScene()
	createSea()
	createSky()
	createLights()
	createPlane()

	resetMap()
}



function resetMap() {
	game = {
		status: 'playing',

		speed: 0,
		paused: false,
		baseSpeed: 0.00035,
		targetBaseSpeed: 0.00035,
		speedLastUpdate: 0,

		distance: 0,

		coins: 0,
		fpv: false,

		// gun spawning
		spawnedSimpleGun: false,
		spawnedDoubleGun: false,
		spawnedBetterGun: false,

		lastLifeSpawn: 0,
		lifes: world.maxLifes,

		level: 1,
		levelLastUpdate: 0,

		planeFallSpeed: 0.001,
		planeSpeed: 0,
		planeCollisionDisplacementX: 0,
		planeCollisionSpeedX: 0,
		planeCollisionDisplacementY: 0,
		planeCollisionSpeedY: 0,

		coinLastSpawn: 0,
		enemyLastSpawn: 0,

		statistics: {
			coinsCollected: 0,
			coinsSpawned: 0,
			enemiesKilled: 0,
			enemiesSpawned: 0,
			shotsFired: 0,
			lifesLost: 0,
		}
	}

	// update ui
	ui.updateDistanceDisplay()
	ui.updateLevelCount()
	ui.updateLifesDisplay()
	ui.updateCoinsCount()

	sceneManager.clear()

	sea.updateColor()
	sea2.updateColor()

	setSideView()

	airplane.equipWeapon(null)

	pollutionOverlay.material.opacity = 0.0;
	pollutionOverlay.material.color.set(0x888888);
	document.getElementById('power-warning').style.display = 'none';
	document.getElementById('blackout-overlay').style.opacity = '0.0';

	// airplane.equipWeapon(new SimpleGun())
	// airplane.equipWeapon(new DoubleGun())
	// airplane.equipWeapon(new BetterGun())
}



let soundPlaying = false

function startMap() {
	if (!soundPlaying) {
		audioManager.play('propeller', {loop: true, volume: 1})
		audioManager.play('ocean', {loop: true, volume: 1})
		soundPlaying = true
	}

	createWorld()
	loop()

	ui.informNextLevel(1)
	game.paused = false
}



function onWebsiteLoaded(event) {
	// load audio
	audioManager.load('ocean', null, '/audio/ocean.mp3')
	audioManager.load('propeller', null, '/audio/propeller.mp3')

	audioManager.load('coin-1', 'coin', '/audio/coin-1.mp3')
	audioManager.load('coin-2', 'coin', '/audio/coin-2.mp3')
	audioManager.load('coin-3', 'coin', '/audio/coin-3.mp3')
	audioManager.load('jar-1', 'coin', '/audio/jar-1.mp3')
	audioManager.load('jar-2', 'coin', '/audio/jar-2.mp3')
	audioManager.load('jar-3', 'coin', '/audio/jar-3.mp3')
	audioManager.load('jar-4', 'coin', '/audio/jar-4.mp3')
	audioManager.load('jar-5', 'coin', '/audio/jar-5.mp3')
	audioManager.load('jar-6', 'coin', '/audio/jar-6.mp3')
	audioManager.load('jar-7', 'coin', '/audio/jar-7.mp3')

	audioManager.load('airplane-crash-1', 'airplane-crash', '/audio/airplane-crash-1.mp3')
	audioManager.load('airplane-crash-2', 'airplane-crash', '/audio/airplane-crash-2.mp3')
	audioManager.load('airplane-crash-3', 'airplane-crash', '/audio/airplane-crash-3.mp3')

	audioManager.load('bubble', 'bubble', '/audio/bubble.mp3')

	audioManager.load('shot-soft', 'shot-soft', '/audio/shot-soft.mp3')

	audioManager.load('shot-hard', 'shot-hard', '/audio/shot-hard.mp3')

	audioManager.load('bullet-impact', 'bullet-impact', '/audio/bullet-impact-rock.mp3')

	audioManager.load('water-splash', 'water-splash', '/audio/water-splash.mp3')
	audioManager.load('rock-shatter-1', 'rock-shatter', '/audio/rock-shatter-1.mp3')
	audioManager.load('rock-shatter-2', 'rock-shatter', '/audio/rock-shatter-2.mp3')

	// load models
	modelManager.load('heart')

	ui = new UI(startMap)

	// 종료 : 경고 메세지 => html 생성
	const warningElem = document.createElement('div');
	warningElem.id = 'power-warning';
	warningElem.innerText = '⚠️ POWER OUTAGE ⚠️';
	warningElem.style = `
	position: absolute;
	top: 40%;
	left: 50%;
	transform: translate(-50%, -50%);
	font-size: 48px;
	font-weight: bold;
	color: red;
	display: none;
	animation: blink 1s infinite;
	z-index: 999;
	`;
	document.body.appendChild(warningElem);

	// CSS 애니메이션 정의
	const style = document.createElement('style');
	style.innerHTML = `@keyframes blink { 0%, 100% {opacity: 0;} 50% {opacity: 1;} }`;
	document.head.appendChild(style);

	loadingProgressManager
		.catch((err) => {
			ui.showError(err.message)
		})
}


window.addEventListener('load', onWebsiteLoaded, false)
