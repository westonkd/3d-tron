/*
 * Game Core - Demo 1 (Simple demo)
 *
 * A simple example with basic controls (see _game.core.js for an uncommented version of this file)
 */

window.game = window.game || {};

window.game.core = function () {
	var _game = {
		// Attributes
		player: {
			score: 0,

			// Tilt Attributes
			tilt: 90 * Math.PI / 180,
			isTurningRight: false,
			isTurningLeft: false,
			leftTiltLimit: 91 * Math.PI / 180,
			rightTiltLimit: 89 * Math.PI / 180,
			maxTiltLeft: 110 * Math.PI / 180,
			maxTiltRight: 65 * Math.PI / 180,
			tiltStep: 1 * Math.PI / 180,

			//Light trail
			trailGeometry: null,
			trailGeometryTop: null,
			trailSize: 10000,
			trailOffset: null,
			trailMaterial: null,

			//timer
			startTime: null,
			currentTime: null,

			//lightbox
			lightBox: null,

			// Player entity including mesh and rigid body
			model: null,
			mesh: null,
			shape: null,
			rigidBody: null,
			// Player mass which affects other rigid bodies in the world
			mass: 10,

			// HingeConstraint to limit player's air-twisting
			orientationConstraint: null,

			// Jump flags
			isGrounded: false,
			jumpHeight: 45,

			// Configuration for player speed (acceleration and maximum speed)
			speed: 30.0,
			speedMax: 110,
			// Configuration for player rotation (rotation acceleration and maximum rotation speed)
			rotationSpeed: 0.007,
			rotationSpeedMax: 0.04,
			// Rotation values
			rotationRadians: new THREE.Vector3(0, 0, 0),
			rotationAngleX: null,
			rotationAngleY: null,
			// Damping which means deceleration	(values between 0.8 and 0.98 are recommended)
			damping: 0.9,
			// Damping or easing for player rotation
			rotationDamping: 0.8,
			// Acceleration values
			acceleration: 0,
			rotationAcceleration: 0,
			// Enum for an easier method access to acceleration/rotation
			playerAccelerationValues: {
				position: {
					acceleration: "acceleration",
					speed: "speed",
					speedMax: "speedMax"
				},
				rotation: {
					acceleration: "rotationAcceleration",
					speed: "rotationSpeed",
					speedMax: "rotationSpeedMax"
				}
			},

			// Third-person camera configuration
			playerCoords: null,
			cameraCoords: null,
			// Camera offsets behind the player (horizontally and vertically)
			cameraOffsetH: 200,
			cameraOffsetV: 60,

			// Keyboard configuration for game.events.js (controlKeys must be associated to game.events.keyboard.keyCodes)
			controlKeys: {
				forward: "w",
				backward: "s",
				left: "a",
				right: "d",
				jump: "space"
			},

			// Methods
			create: function() {
				//get the current time
				_game.player.startTime = new Date().getTime() / 1000;

				// Create a global physics material for the player which will be used as ContactMaterial for all other objects in the level
				_cannon.playerPhysicsMaterial = new CANNON.Material("playerMaterial");

				// Create a player character based on an imported 3D model that was already loaded as JSON into game.models.player
				_game.player.model = _three.createModel(window.game.models.player, 25, [
					new THREE.MeshLambertMaterial({ color: window.game.static.colors.cyan,transparent: true, opacity: 0.0, shading: THREE.FlatShading }),
					new THREE.MeshLambertMaterial({ color: window.game.static.colors.green,transparent: true, opacity: 0.0, shading: THREE.FlatShading })
				]);

				_game.player.model.mesh.applyMatrix( new THREE.Matrix4().makeScale( 2, 1, 1 ) )

				//add cycle
				var loader = new THREE.ObjectLoader();
				var cycle = new THREE.Object3D();
				loader.load("game.tron.json",function (obj) {
				     cycle.add(obj);
				});

				cycle.scale.set(10,10,10);
				cycle.rotation.x = 90 * Math.PI / 180;

				//set the scale
				cycle.applyMatrix( new THREE.Matrix4().makeScale( 6, 10, 10 ) )

				//add a box for the light to come from
				var geometry = new THREE.CubeGeometry(.2, 3, 2 );
				var material = new THREE.MeshBasicMaterial( {color: 0x00ff00,transparent: true, opacity: 0.0} );
				_game.player.lightBox = new THREE.Mesh( geometry, material );
				_game.player.lightBox.position.set(5,2,0);
				cycle.add( _game.player.lightBox );

				_game.player.model.mesh.add(cycle);

				// Create the shape, mesh and rigid body for the player character and assign the physics material to it
				_game.player.shape = new CANNON.Box(_game.player.model.halfExtents);
				_game.player.rigidBody = new CANNON.RigidBody(_game.player.mass, _game.player.shape, _cannon.createPhysicsMaterial(_cannon.playerPhysicsMaterial));
				_game.player.rigidBody.position.set(0, 0, 50);
				_game.player.mesh = _cannon.addVisual(_game.player.rigidBody, null, _game.player.model.mesh);

				// Create a HingeConstraint to limit player's air-twisting - this needs improvement
				_game.player.orientationConstraint = new CANNON.HingeConstraint(_game.player.rigidBody, new CANNON.Vec3(0, 0, 0), new CANNON.Vec3(0, 0, 1), _game.player.rigidBody, new CANNON.Vec3(0, 0, 1), new CANNON.Vec3(0, 0, 1));
				_cannon.world.addConstraint(_game.player.orientationConstraint);

				_game.player.rigidBody.postStep = function() {
					// Reset player's angularVelocity to limit possible exceeding rotation and
					_game.player.rigidBody.angularVelocity.z = 0;

					// update player's orientation afterwards
					_game.player.updateOrientation();
				};

				// Collision event listener for the jump mechanism
				_game.player.rigidBody.addEventListener("collide", function(event) {
					// Checks if player's is on ground
					if (!_game.player.isGrounded) {
						// Ray intersection test to check if player is colliding with an object beneath him
						_game.player.isGrounded = (new CANNON.Ray(_game.player.mesh.position, new CANNON.Vec3(0, 0, -1)).intersectBody(event.contact.bi).length > 0);
					}
				});

				//create the trail
				_game.player.trail.create();

			},
			trail: {
				create: function() {
					var trailLine;
					var trailLineTop;

					_game.player.trailGeometry = new THREE.Geometry();
					_game.player.trailGeometryTop = new THREE.Geometry();

					_game.player.trailMaterial = new THREE.LineBasicMaterial({
						color: window.game.static.colors.neonorange,
						linewidth: 1000
					});

					for (var i = 0; i < _game.player.trailSize; i++) {
						_game.player.trailGeometry.vertices.push(new THREE.Vector3(0, 0, 50));
						_game.player.trailGeometryTop.vertices.push(new THREE.Vector3(0, 0, 50));
					}

					trailLine = new THREE.Line(_game.player.trailGeometry, _game.player.trailMaterial);
					trailLineTop = new THREE.Line(_game.player.trailGeometryTop, _game.player.trailMaterial);

					_three.scene.add(trailLine);
					_three.scene.add(trailLineTop);
				},
				update: function() {
					//update the current time
					_game.player.currentTime = new Date().getTime() / 1000;

					//get the position of the lightbox
					_three.scene.updateMatrixWorld();
					var newPosition = new THREE.Vector3();
					newPosition.getPositionFromMatrix(_game.player.lightBox.matrixWorld);

					_game.player.trailGeometry.vertices[_game.player.trailSize - 1] = new THREE.Vector3(
						newPosition.x,
						newPosition.y,
						newPosition.z - 8
					);

					_game.player.trailGeometryTop.vertices[_game.player.trailSize - 1] = new THREE.Vector3(
						newPosition.x,
						newPosition.y,
						newPosition.z + 4
					);

					for (var i = 0; i < _game.player.trailSize - 1; i++) {
						_game.player.trailGeometry.vertices[i] = _game.player.trailGeometry.vertices[i + 1];
					}

					for (var i = 0; i < _game.player.trailSize - 1; i++) {
						_game.player.trailGeometryTop.vertices[i] = _game.player.trailGeometryTop.vertices[i + 1];
					}

					_game.player.trailGeometry.verticesNeedUpdate = true;
					_game.player.trailGeometryTop.verticesNeedUpdate = true;
				}
			},
			update: function() {
				// Basic game logic to update player and camera
				_game.player.processUserInput();
				_game.player.accelerate();
				_game.player.rotate();
				_game.player.updateCamera();

				//always move forward
				_game.player.updateAcceleration(_game.player.playerAccelerationValues.position, 1);

				//update the light trail
				_game.player.trail.update();

				// Level-specific logic
				_game.player.checkGameOver();
			},
			updateCamera: function() {
				// Calculate camera coordinates by using Euler radians from player's last rotation
				_game.player.cameraCoords = window.game.helpers.polarToCartesian(_game.player.cameraOffsetH, _game.player.rotationRadians.z);

				// Apply camera coordinates to camera position
				_three.camera.position.x = _game.player.mesh.position.x + _game.player.cameraCoords.x;
				_three.camera.position.y = _game.player.mesh.position.y + _game.player.cameraCoords.y;
				_three.camera.position.z = _game.player.mesh.position.z + _game.player.cameraOffsetV;

				// Place camera focus on player mesh
				_three.camera.lookAt(_game.player.mesh.position);
			},

			updateAcceleration: function(values, direction) {
				// Distinguish between acceleration/rotation and forward/right (1) and backward/left (-1)
				if (direction === 1) {
					// Forward/right
					if (_game.player[values.acceleration] > -_game.player[values.speedMax]) {
						if (_game.player[values.acceleration] >= _game.player[values.speedMax] / 2) {
							_game.player[values.acceleration] = -(_game.player[values.speedMax] / 4);
						} else {
							_game.player[values.acceleration] -= _game.player[values.speed];
						}
					} else {
						_game.player[values.acceleration] = -_game.player[values.speedMax];
					}
				} else {
					// Backward/left
					if (_game.player[values.acceleration] < _game.player[values.speedMax]) {
						if (_game.player[values.acceleration] <= -(_game.player[values.speedMax] / 2)) {
							_game.player[values.acceleration] = -(_game.player[values.speedMax] / 4);
						} else {
							_game.player[values.acceleration] += _game.player[values.speed];
						}
					} else {
						_game.player[values.acceleration] = _game.player[values.speedMax];
					}
				}
			},
			processUserInput: function() {
				// Jump
				if (_events.keyboard.pressed[_game.player.controlKeys.jump]) {
					_game.player.jump();
				}

				// Movement: forward, backward, left, right
				if (_events.keyboard.pressed[_game.player.controlKeys.forward]) {
					_game.player.updateAcceleration(_game.player.playerAccelerationValues.position, 1);

					// Reset orientation in air
					if (!_cannon.getCollisions(_game.player.rigidBody.index)) {
						_game.player.rigidBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), _game.player.rotationRadians.z);
					}
				}

				if (_events.keyboard.pressed[_game.player.controlKeys.backward]) {
					_game.player.updateAcceleration(_game.player.playerAccelerationValues.position, 0.001);
				}

				if (_events.keyboard.pressed[_game.player.controlKeys.right]) {
					_game.player.updateAcceleration(_game.player.playerAccelerationValues.rotation, 1);

					//the player is turning right
					_game.player.isTurningRight = true;

					//increase the tilt
					if (_game.player.tilt > _game.player.maxTiltRight) {
						_game.player.tilt -= _game.player.tiltStep;
					}
				}

				if (_events.keyboard.pressed[_game.player.controlKeys.left]) {
					_game.player.updateAcceleration(_game.player.playerAccelerationValues.rotation, -1);
					_game.player.isTurningLeft = true;
					if (_game.player.tilt < _game.player.maxTiltLeft) {
						_game.player.tilt += _game.player.tiltStep;
					}
				}
			},
			accelerate: function() {
				// Calculate player coordinates by using current acceleration Euler radians from player's last rotation
				_game.player.playerCoords = window.game.helpers.polarToCartesian(_game.player.acceleration, _game.player.rotationRadians.z);

				// Set actual XYZ velocity by using calculated Cartesian coordinates
				_game.player.rigidBody.velocity.set(_game.player.playerCoords.x, _game.player.playerCoords.y, _game.player.rigidBody.velocity.z);

				// Damping
				if (!_events.keyboard.pressed[_game.player.controlKeys.forward] && !_events.keyboard.pressed[_game.player.controlKeys.backward]) {
					_game.player.acceleration *= _game.player.damping;
				}
			},
			resetTilt: function() {
				//if the player is tilted right
				if (!_game.player.isTurningRight && _game.player.tilt < _game.player.rightTiltLimit) {
					_game.player.tilt += _game.player.tiltStep;
				}
				//if the player is tilted left
				else if (!_game.player.isTurningLeft && _game.player.tilt > _game.player.leftTiltLimit) {
					_game.player.tilt -= _game.player.tiltStep;
				}
			},
			rotate: function() {
				// Rotate player around Z axis
				_cannon.rotateOnAxis(_game.player.rigidBody, new CANNON.Vec3(0, 0, 1), _game.player.rotationAcceleration);

				//titlt player model
				_game.player.model.mesh.children[0].rotation.x = _game.player.tilt;

				//update tilt towardds normal
				_game.player.resetTilt();

				// Damping
				if (!_events.keyboard.pressed[_game.player.controlKeys.left] && !_events.keyboard.pressed[_game.player.controlKeys.right]) {
					_game.player.rotationAcceleration *= _game.player.rotationDamping;
				}
			},
			jump: function() {
				// Perform a jump if player has collisions and the collision contact is beneath him (ground)
				if (_cannon.getCollisions(_game.player.rigidBody.index) && _game.player.isGrounded) {
					_game.player.isGrounded = false;
					_game.player.rigidBody.velocity.z = _game.player.jumpHeight;
				}
			},
			updateOrientation: function() {
				// Convert player's Quaternion to Euler radians and save them to _game.player.rotationRadians
				_game.player.rotationRadians = new THREE.Euler().setFromQuaternion(_game.player.rigidBody.quaternion);

				// Round angles
				_game.player.rotationAngleX = Math.round(window.game.helpers.radToDeg(_game.player.rotationRadians.x));
				_game.player.rotationAngleY = Math.round(window.game.helpers.radToDeg(_game.player.rotationRadians.y));

				// Prevent player from being upside-down on a slope - this needs improvement
				if ((_cannon.getCollisions(_game.player.rigidBody.index) &&
					((_game.player.rotationAngleX >= 90) ||
						(_game.player.rotationAngleX <= -90) ||
						(_game.player.rotationAngleY >= 90) ||
						(_game.player.rotationAngleY <= -90)))
					)
				{
					// Reset orientation
					_game.player.rigidBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), _game.player.rotationRadians.z);
				}
			},
			checkGameOver: function () {
				// Example game over mechanism which resets the game if the player is falling beneath -800
				if (_game.player.mesh.position.z <= -800) {
					_game.destroy();
				}

				if (_game.level.hasStarted) {
					//check if light trail is touching the player
					var topTrail = _game.player.trailGeometry.clone();
					var playerPosition = _game.player.mesh.position;

					for (var i = topTrail.vertices.length - 1; i >= 0; i--) {

						deltaX = topTrail.vertices[i].x - playerPosition.x;
						deltaY = topTrail.vertices[i].y - playerPosition.y;
						deltaZ = topTrail.vertices[i].z - playerPosition.z;

						var distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ);
						if (distance < 40) {
							console.log("hit" + distance);
							_game.destroy();
						}
					}
				}

			}
		},
		checkpoint: {
			model: null,

			create: function() {
				var min = _game.level.floorSize / 2 * -1;
				var max = min * -1;

				var x = Math.random() * (max - min) + min;
				var y = Math.random() * (max - min) + min;

				var geometry = new THREE.SphereGeometry( 100, 32, 32 );
				var material = new THREE.MeshBasicMaterial( {color: 0xffff00} );
				_game.checkpoint.model = new THREE.Mesh( geometry, material );
				_game.checkpoint.model.name = "currentCheckpoint";
				_game.checkpoint.model.position.x = x;
				_game.checkpoint.model.position.y = y;

				_three.scene.add(_game.checkpoint.model);
			},

			update: function() {
				//check if the player is close

				var playerPosition = _game.player.mesh.position;

				var deltaX = _game.checkpoint.model.position.x - playerPosition.x;
				var deltaY = _game.checkpoint.model.position.y - playerPosition.y;
				var deltaZ = _game.checkpoint.model.position.z - playerPosition.z;

				var distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ);
				document.querySelector('#check').innerHTML = "Checkpoint Distance: " + Math.round(distance);

				//if there is a hit
				if (distance < 100) {
					console.log("hit checkpoint");
					var currentCheckpoint = _three.scene.getObjectByName("currentCheckpoint");
					console.log(currentCheckpoint);
					if (currentCheckpoint) {
						//remove the checkpoint
						_three.scene.remove(currentCheckpoint);

						//update the player score
						_game.player.score += 50;
						document.querySelector("#score").innerHTML = "Score: <strong>" + _game.player.score + "</strong>";

						//increase the speed
						_game.player.speedMax += 30;

						//create a new checkpoint
						_game.checkpoint.create();
					}
				}
			}
		},

		level: {
			hasStarted: false,
			floorSize: 10000,

			// Methods
			create: function() {
				// Create a solid material for all objects in the world
				_cannon.solidMaterial = _cannon.createPhysicsMaterial(new CANNON.Material("solidMaterial"), 0, 0.1);

				// Define floor setting
				var floorHeight = 5;

				// Add a floor
				_cannon.createRigidBody({
					shape: new CANNON.Box(new CANNON.Vec3(_game.level.floorSize, _game.level.floorSize, floorHeight)),
					mass: 0,
					position: new CANNON.Vec3(0, 0, -floorHeight),
					meshMaterial: new THREE.MeshPhongMaterial({ color: window.game.static.colors.black }),
					physicsMaterial: _cannon.solidMaterial
				});

				//var box = _cannon.createRigidBody({
				//	shape: new CANNON.Box(new CANNON.Vec3(200, 200, 200)),
				//	mass: 1,
				//	position: new CANNON.Vec3(-320, 0, 20),
				//	meshMateriatl: new THREE.MeshLambertMaterial({ color: window.game.static.colors.cyan }),
				//	physicsMaterial: _cannon.solidMaterial
				//});


				// Grid Helper
				var grid = new THREE.GridHelper(_game.level.floorSize, _game.level.floorSize / 150);
				grid.position.z = 0.5;
				grid.rotation.x = window.game.helpers.degToRad(90);
				grid.setColors(window.game.static.colors.neonblue,window.game.static.colors.neonblue);
				_three.scene.add(grid);
			}
		},

		// Methods
		init: function(options) {
			// Setup necessary game components (_events, _three, _cannon, _ui)
			_game.initComponents(options);

			// Create player and level
			_game.player.create();
			_game.level.create();
			_game.checkpoint.create();

			// Initiate the game loop
			_game.loop();
		},
		destroy: function() {
			// Pause animation frame loop
			window.cancelAnimationFrame(_animationFrameLoop);

			// Destroy THREE.js scene and Cannon.js world and recreate them
			_cannon.destroy();
			_cannon.setup();
			_three.destroy();
			_three.setup();

			// Recreate player and level objects by using initial values which were copied at the first start
			_game.player = window.game.helpers.cloneObject(_gameDefaults.player);
			_game.level = window.game.helpers.cloneObject(_gameDefaults.level);
			_game.checkpoint.create();

			//reset the player score
			//reset the score
			_game.player.score = 0;
			document.querySelector("#score").innerHTML = "Score: " + _game.player.score;

			// Level has ended
			_game.level.hasStarted = false;

			// Create player and level again
			_game.player.create();
			_game.level.create();

			// Continue with the game loop
			_game.loop();
		},
		loop: function() {
			// Assign an id to the animation frame loop
			_animationFrameLoop = window.requestAnimationFrame(_game.loop);

			// Update Cannon.js world and player state
			_cannon.updatePhysics();
			_game.player.update();

			//update the checkpoint
			_game.checkpoint.update();

			//check if we need to start collision checking
			if (_game.player.currentTime - _game.player.startTime > 2.0) {
				_game.level.hasStarted = true;
			}

			// Render visual scene
			_three.render();
		},
		initComponents: function (options) {
			// Reference game components one time
			_events = window.game.events();
			_three = window.game.three();
			_cannon = window.game.cannon();
			_ui = window.game.ui();

			// Setup lights for THREE.js
			_three.setupLights = function () {
				var hemiLight = new THREE.HemisphereLight(window.game.static.colors.white, window.game.static.colors.white, 0.6);
				hemiLight.position.set(0, 0, -1);
				_three.scene.add(hemiLight);

				var pointLight = new THREE.PointLight(window.game.static.colors.white, 0.5);
				pointLight.position.set(0, 0, 500);
				_three.scene.add(pointLight);

			};

			// Initialize components with options
			_three.init(options);
			_cannon.init(_three);
			_ui.init();
			_events.init();

			// Add specific events for key down
			_events.onKeyDown = function () {
				if (!_ui.hasClass("infoboxIntro", "fade-out")) {
					_ui.fadeOut("infoboxIntro");
				}
			};

			_events.onKeyUp = function(event) {
				//No longer turning
				_game.player.isTurningRight = false;
				_game.player.isTurningLeft = false;
			}
		}
	};

	// Internal variables
	var _events;
	var _three;
	var _cannon;
	var _ui;
	var _animationFrameLoop;
	// Game defaults which will be set one time after first start
	var _gameDefaults = {
		player: window.game.helpers.cloneObject(_game.player),
		level: window.game.helpers.cloneObject(_game.level)
	};

	return _game;
};
