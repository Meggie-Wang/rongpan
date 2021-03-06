var masterContainer = document.getElementById('visualization');

var mapOutlineImage;

//	where in html to hold all our things
var glContainer = document.getElementById( 'glContainer' );
var dpr = window.devicePixelRatio ? window.devicePixelRatio : 1;

// var lang = getLang();
var dict;

//	contains a list of facility codes with their matching facility names
// var facilityFile = 'data/facility.' + lang + '.json';
// var missileFile = 'data/missile.' + lang + '.json';
// var dictFile = 'data/dict.' + lang + '.json';

var camera, scene, renderer;
var camera2s, scene2d;

var sphere;
var rotating;
var visualizationMesh;

//	contains the data loaded from the test data file
//	contains a list of years, followed by tests within that year
var timeBins;

//	contains above but organized as a mapped list via ['facilityname'] = facilityobject
//	each facility object has data like center of facility in 3d space, lat lon and facility name
var facilityData = new Object();
var testData = new Object();

//	contains latlon data for each facility
var latlonData = {
	"hlj": {"lat": 39.90, "lon": 116.38},
	"facilities": {"USA_Western": {"name": "USA_Western", "lat": 39.90, "lon": 116.38}}
};

//	contains a list of missile code to missile name for running lookups
var missileLookup = {"USA_Western": {"name": "USA_Western", "type": "USA_Western"} };

//	A list of missile colors
// 排名top5国家都攻击hlj，火箭的颜色按照国家分类
var missileColorsArr = [0x3399f3, 0x279221, 0xFD690F, 0xAEB21A, 0x814EAF];
var missileColors = {'USA_Western': 0x3399f3};

var missleName = {'USA_Western': 'USA_Western'}

var yearIndexLookup = {};
var selectableTests = [];
var summary;

//	a list of outcome 'codes'
//	now they are just strings of categories
//	Outcome Code : Outcome Node
var outcomeLookup = {
	'success': 'Success',
	'failure': 'Failure',
	'unknown': 'Unknown'
};


//	the currently selected test
var selectedTest = null;
var previouslySelectedTest = null;

//	contains info about what year, what tests, outcomes, missiles, etc that's being visualized
var selectionData;

// 设置相机偏移量
var globe_x = -90, globe_y = -3;

// 相机放大的倍数
var cameraMin = 0.65, cameraMax = 0.65, cameraWheelMax = 0.75;

// mini map scroll ip
var defalutHoneypot = '';
var swiper, swiperData;

// 自转
var rotateVYAdd,
		rotateSpeed = 0.00001,
		rotateDelay = 5000,
		markerSelected = true,
		keyUp = false,
		keyUpTimeout = {};

var globeTags = [];

//	TODO
//	use underscore and ".after" to load these in order
//	don't look at me I'm ugly
function start(e) {
	//	detect for webgl and reject everything else
	if (!Detector.webgl) {
		Detector.addGetWebGLMessage();
	} else {
		//	ensure the map images are loaded first!!
		mapOutlineImage = new Image();
		mapOutlineImage.src = 'images/map_outline.png';
		mapOutlineImage.onload = function() {
			// 为了防止sibebar卡顿，使得加载数据在0.5（sidebar运行时间）后执行
    	setTimeout(function () {
				loadTestData(function() {
					initScene();
					showMiniMaps(defalutHoneypot);
					animate();
				});
			}, 500)
		};
	};
}


var Selection = function(selectedYear, selectedTest) {
	this.selectedYear = selectedYear;
	this.selectedTest = selectedTest;

	this.outcomeCategories = new Object();
	for (var i in outcomeLookup) {
		this.outcomeCategories[i] = true;
	}
	this.missileCategories = new Object();
	for (var i in missileLookup) {
		this.missileCategories[i] = true;
	}

	this.getOutcomeCategories = function() {
		var list = [];
		for (var i in this.outcomeCategories) {
			if (this.outcomeCategories[i]) {
				list.push(i);
			}
		}
		return list;
	}

	this.getMissileCategories = function() {
		var list = [];
		for (var i in this.missileCategories) {
			if (this.missileCategories[i]) {
				list.push(i);
			}
		}
		return list;
	}
};

//	-----------------------------------------------------------------------------
//	All the initialization stuff for THREE
function initScene() {
	//	-----------------------------------------------------------------------------
	//	Let's make a scene
	scene = new THREE.Scene();
	scene.matrixAutoUpdate = false;
	// scene.fog = new THREE.FogExp2( 0xBBBBBB, 0.00003 );

	scene2d = new THREE.Scene();

	scene.add( new THREE.AmbientLight( 0x505050 ) );

	light1 = new THREE.SpotLight( 0xeeeeee, 3 );
	light1.position.x = 730;
	light1.position.y = 520;
	light1.position.z = 626;
	light1.castShadow = true;
	scene.add( light1 );

	light2 = new THREE.PointLight( 0x222222, 14.8 );
	light2.position.x = -640;
	light2.position.y = -500;
	light2.position.z = -1000;
	scene.add( light2 );

	rotating = new THREE.Object3D(); // 图形对象的基类。
	scene.add(rotating);

	var outlinedMapTexture = new THREE.Texture( mapOutlineImage );
	outlinedMapTexture.needsUpdate = true;
	// outlinedMapTexture.magFilter = THREE.NearestFilter;
	// outlinedMapTexture.minFilter = THREE.NearestFilter;

	var mapMaterial = new THREE.MeshBasicMaterial({
		map: outlinedMapTexture,
		polygonOffset: true,
		polygonOffsetFactor: 1,
		polygonOffsetUnits: 1
	});


	//	----------------------------------------------------------------------------- 球
	sphere = new THREE.Mesh( new THREE.SphereBufferGeometry( 100, 40, 40 ), mapMaterial ); // 第一个参数radius将球半径变小了
	sphere.doubleSided = true;
	sphere.rotation.x = Math.PI;
	sphere.rotation.y = -Math.PI/2;
	sphere.rotation.z = Math.PI;
	sphere.id = "base";
	rotating.add( sphere );


	var wireframeGeo = new THREE.EdgesGeometry(sphere.geometry, 0.3);
	var wireframeMaterial = new THREE.LineBasicMaterial({
		color: Math.random() * 0xffffff,
		linewidth: 0.5
	});
	var wireframe = new THREE.LineSegments(wireframeGeo, wireframeMaterial);
	// sphere.add(wireframe); // 外层的线纹理

	var atmosphereMaterial = new THREE.ShaderMaterial({
		vertexShader: document.getElementById('vertexShaderAtmosphere').textContent,
		fragmentShader: document.getElementById('fragmentShaderAtmosphere').textContent,
		// atmosphere should provide light from behind the sphere, so only render the back side
		side: THREE.BackSide
	});

	var atmosphere = new THREE.Mesh(sphere.geometry.clone(), atmosphereMaterial);
	atmosphere.scale.x = atmosphere.scale.y = atmosphere.scale.z = 1.8;
	rotating.add(atmosphere); // 模拟大气

	//	----------------------------------------------------------------------------- custom
	for( var i in timeBins ){
		var bin = timeBins[i].data;
		for( var s in bin ){
			var set = bin[s];
			var testName = (set.date + ' ' + missileLookup[set.missile].name).toUpperCase();
			selectableTests.push( testName );
		}
	}


	// load geo data (facility lat lons in this case)
	// 一种手动测试速度的方法
	console.time('loadGeoData');
	loadGeoData( latlonData );
	console.timeEnd('loadGeoData');

	console.time('buildDataVizGeometries');
	var vizilines = buildDataVizGeometries(timeBins);
	console.timeEnd('buildDataVizGeometries');

	visualizationMesh = new THREE.Object3D();
	rotating.add(visualizationMesh);

	var latestBin = timeBins[timeBins.length - 1];
	var selectedYear = latestBin.year;	

	var latestTest = latestBin.data[latestBin.data.length - 1];
	var selectedTestName = latestTest.testName;

	selectionData = new Selection(selectedYear, selectedTestName);

	selectVisualization(timeBins, selectedYear, [selectedTestName], Object.keys(outcomeLookup), Object.keys(missileLookup));


	//	----------------------------------------------------------------------------- end

	//	Setup our renderer
	renderer = new THREE.WebGLRenderer({antialias:false, alpha: true});
	renderer.setPixelRatio(dpr);
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.autoClear = false;
	// renderer.setClearColor(0xff0000)
	// renderer.setClearColor(0xff0000, 0);
	renderer.setClearColor( 0xffffff, 0);


	renderer.sortObjects = false;
	renderer.generateMipmaps = false;

	glContainer.appendChild( renderer.domElement );


	// Detect passive event support
	var passive = false;
	var options = Object.defineProperty({}, 'passive', {
		get: function() {
			passive = true;
		}
	});
	document.addEventListener('testPassiveEventSupport', function() {}, options);
	document.removeEventListener('testPassiveEventSupport', function() {}, options);

	//	-----------------------------------------------------------------------------
	//	Event listeners
	document.addEventListener( 'mousemove', onDocumentMouseMove, true );
	document.addEventListener( 'touchmove', onDocumentMouseMove, passive ? { capture: true, passive: false } : true );
	document.addEventListener( 'windowResize', onDocumentResize, false );

	//masterContainer.addEventListener( 'mousedown', onDocumentMouseDown, true );
	//masterContainer.addEventListener( 'mouseup', onDocumentMouseUp, false );
	document.addEventListener( 'mousedown', onDocumentMouseDown, true );
	document.addEventListener( 'touchstart', onDocumentMouseDown, passive ? { capture: true, passive: false } : true );
	document.addEventListener( 'mouseup', onDocumentMouseUp, false );
	document.addEventListener( 'touchend', onDocumentMouseUp, false );
	document.addEventListener( 'touchcancel', onDocumentMouseUp, false );

	var mc = new Hammer(document);
	mc.get('pinch').set({ enable: true });
	mc.get('pan').set({ threshold: 0, pointers: 3, direction: Hammer.DIRECTION_VERTICAL });
	mc.on('pinchstart pinchmove', onDocumentPinch);
	mc.on('panmove', onDocumentPan);

	masterContainer.addEventListener( 'click', onClick, true );
	masterContainer.addEventListener( 'mousewheel', onMouseWheel, false );

	//	firefox
	masterContainer.addEventListener( 'DOMMouseScroll', function(e){
			var evt=window.event || e; //equalize event object
			onMouseWheel(evt);
	}, false );

	document.addEventListener( 'keydown', onKeyDown, false);

	//	-----------------------------------------------------------------------------
	//	Setup our camera
	var aspect = window.innerWidth / window.innerHeight;
	camera = new THREE.PerspectiveCamera(30 / Math.min(aspect, 1), aspect, 1, 1000);
	camera.position.z = 400;
	camera.position.y = 0;
	camera.lookAt(scene.position);
	camera.zoom = cameraMin;
	scene.add( camera );

	camera2d = new THREE.OrthographicCamera(0, window.innerWidth, 0, window.innerHeight, 1, 20000);
	camera2d.position.z = 400;
	camera2d.position.y = 0;
	camera.lookAt(scene2d.position);

	var windowResize = THREEx.WindowResize(renderer, camera, camera2d);


}

function animate() {

	//	Disallow roll for now, this is interfering with keyboard input during search
	/*
		if(keyboard.pressed('o') && keyboard.pressed('shift') == false)
			camera.rotation.z -= 0.08;
		if(keyboard.pressed('p') && keyboard.pressed('shift') == false)
			camera.rotation.z += 0.08;
	*/

	if( rotateTargetX !== undefined && rotateTargetY !== undefined ){

		rotateVX += (rotateTargetX - rotateX) * 0.012;
		rotateVY += (rotateTargetY - rotateY) * 0.012;

		// var move = new THREE.Vector3( rotateVX, rotateVY, 0 );
		// var distance = move.length();
		// if( distance > .01 )
		// 	distance = .01;
		// move.normalize();
		// move.multiplyScalar( distance );

		// rotateVX = move.x;
		// rotateVy = move.y;

		if( Math.abs(rotateTargetX - rotateX) < 0.02 && Math.abs(rotateTargetY - rotateY) < 0.02 ){
			rotateTargetX = undefined;
			rotateTargetY = undefined;
		}
	}

	rotateX += rotateVX;
	rotateY += rotateVY;

	//rotateY = wrap( rotateY, -Math.PI, Math.PI );

	rotateVX *= 0.98;
	rotateVY *= 0.98;

	if(dragging || rotateTargetX !== undefined ){
		rotateVX *= 0.6;
		rotateVY *= 0.6;
	}

	//	constrain the pivot up/down to the poles
	//	force a bit of bounce back action when hitting the poles
	if(rotateX < -rotateXMax){
		rotateX = -rotateXMax;
		rotateVX *= -0.95;
	}
	if(rotateX > rotateXMax){
		rotateX = rotateXMax;
		rotateVX *= -0.95;
	}

	rotating.rotation.x = rotateX;
	rotating.rotation.y = rotateY;

	if (tiltTarget !== undefined) {
		tilt += (tiltTarget - tilt) * 0.012;
		camera.position.y = 300 * Math.sin(-tilt);
		camera.position.z = 100 + 300 * Math.cos(-tilt);
		camera.lookAt(new THREE.Vector3(0, 0, 100));

		if (Math.abs(tiltTarget - tilt) < 0.05) {
			tiltTarget = undefined;
		}
	}

	if (scaleTarget !== undefined) {
		camera.zoom *= Math.pow(scaleTarget / camera.zoom, 0.012);
		camera.zoom = constrain( camera.zoom, cameraMin, cameraMax )
		camera.updateProjectionMatrix();

		if (Math.abs(Math.log(scaleTarget / camera.zoom)) < cameraMin) {
			scaleTarget = undefined;
		}
	}

	// 控制自转
	// markerSelected = $('.marker').hasClass('selected')
	// if (!markerSelected && !keyUp) {
	rotateVYAdd = rotateSpeed
	// } else {
	// 	rotateVYAdd = 0
	// }
	rotateVY -= rotateVYAdd;
	// ----------------------

	render();

	requestAnimationFrame( animate );


	rotating.traverse(function(mesh) {
		if (mesh.update !== undefined) {
			mesh.update();
		}
	});

	updateMarkers();
	render2d();
}

function render() {
  camera.lookAt({x: globe_x, y: globe_y, z: 0});
	renderer.clear();
	renderer.render( scene, camera );
}

function render2d() {
	renderer.render( scene2d, camera2d );
}

function getHistoricalData() {
	var history = [];

	var outcomeCategories = selectionData.getOutcomeCategories();
	var missileCategories = selectionData.getMissileCategories();

	for( var i in timeBins ){
		var yearBin = timeBins[i].data;
		var value = {successes: 0, failures:0, unknowns:0};
		for( var s in yearBin ){
			var set = yearBin[s];
			var outcomeName = set.outcome;
			var missileName = set.missile;

			var relevantCategory = ( $.inArray(outcomeName, outcomeCategories ) >= 0 ) &&
								   ( $.inArray(missileName, missileCategories ) >= 0 );

			if( relevantCategory == false )
				continue;

			if( outcomeName === 'success' )
				value.successes++;
			else if( outcomeName === 'failure' )
				value.failures++;
			else
				value.unknowns++;
		}
		history.push(value);
	}
	// console.log(history);
	return history;
}