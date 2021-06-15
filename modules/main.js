import {Collision, HitBox, HitCircle} from './collisions.js';
import * as ce from './canvasExtension.js';
import * as inp from './input.js';
import { inputs } from './input.js';
import { Sound, SpatialSound, Music } from './audio.js';
import * as s from './stage.js';
import { Stage, Trigger, StageTrans, noteArr, bossBarEnemyId, whiteOutAlpha } from './stage.js';
import * as sh from './shadows.js';
import { sCanvas, sCtx, ShadowObject, ShadowBox, ShadowCircle } from './shadows.js';
import { moveBullets, drawBullets, drawBulletShadows } from './bullets.js';
export { MainLoop, Draw, debug, consoleDebug, debugEnabled };
import { Enemy } from './enemy.js';
import { RenderObj } from './renderOrder.js';
import { Button, Bridge } from './button.js';
import { RecallStatue, SaveStatue, Save } from './save.js';
import { Player, PlayerProj } from './player.js';
import { Char, Dialog, InteractionText, CreditText } from './dialog.js';
import { Graphic, MapObject, BVH } from './mapObj.js';
export let zoom = 1/1.5;
export let zoomTarget = 1/1.5;
export function changeZoom(amount, multi=true) {
    if (multi) {
        zoomTarget *= amount;
    } else {
        zoomTarget += amount;
    }
}

const canvas = ce.canvas
canvas.style.cursor = 'none';
const c = canvas.getContext("2d", { alpha: false })
const debugEnabled = false;
let debug = false;
let consoleDebug = false;

const TimeCost = {
    frameArr: [],
    inputStepArr: [],
    calcStepArr: [],
    drawStepArr: [],
    interval: 60
}

const MainLoop = { // main "clock" of the entire game
    fps: 60, // you can technically go above 60fps, but only the calculations will go above 60fps while the rendering will remain at 60fps
    lastFrameTimeMs: 0,
    delta: 0,
    cycles: 0,
    firstRefresh: true,
    musicCooldown: 5, // in seconds, gives music time to load before playing
    lastMusicPlayed: 0,
    lastCurrentTime: null,
    music: null,
    activeScene: "title",
    fpsArr: [],
    /* SCENES:
        title
        game
        end
    */
    /*
    =====================
    MAIN LOOP
        ||
        ||
        ||
       _||_
       \  /
        \/
    =====================
    */
    run: function (timestamp) {
        try {
            let fStartTime = performance.now();
            // limit framerate
            // skips frame if the time between the start of the previous frame is lower than what is required for maintaining the fps
            let timestep = 1000 / this.fps
            if (timestamp < this.lastFrameTimeMs + (1000 / this.fps)) {
                return 0;
            }
            if (MainLoop.cycles > 0) {
                this.fpsArr.push(1 / ((timestamp - this.lastFrameTimeMs) / 1000))
                while (this.fpsArr.length > this.fps) {
                    this.fpsArr.splice(0, 1);
                }
            }

            // track change in time since last update
            if (inp.paused) {
                this.delta = 0
            } else {
                // delta is the amount of time this animation frame has to account for. Basically the time the previous frame took to run.
                this.delta += timestamp - this.lastFrameTimeMs

                // if the amount of time the game needs to catch up on (in terms of calculations) exceeds 0.2 seconds, this will reduce the delta (aka: the time that the frame has to account for) back to 0. Prevents freezing when switching tabs or in case the processing speed on your computer is not high enough to maintain the fps;
                if (this.delta > timestep * this.fps * 0.2) {
                    this.delta = 0
                }
            }
            c.resizeCanvas();
            this.lastFrameTimeMs = timestamp;
            if (!inp.paused) {
                // Note: inputSequence runs only once per frame unlike mainSequence. It is useful for input calculations due to the initialPress & initialRelease properties of the inputHandlers only updating once per frame.
                let startTime = performance.now();
                Calculate.inputSequence(this.delta);
                let endTime = performance.now();
                TimeCost.inputStepArr.push(endTime - startTime);
                while (TimeCost.inputStepArr.length > TimeCost.interval) {
                    TimeCost.inputStepArr.splice(0, 1);
                }
                while (this.delta >= timestep && !(this.firstRefresh)) {
                    this.delta -= timestep
                    // Note: mainSequence runs multiple times per animation frame if the time a frame takes to run exceeds the fps cap to make up for lost time. Doing this allows the game to calculate at a higher framerate in case the drawing sequence causes lag, making the screen look more choppy (due to a lower rendering fps) instead of slowing the entire game.
                    startTime = performance.now();
                    Calculate.mainSequence(timestep);
                    endTime = performance.now();
                    TimeCost.calcStepArr.push(endTime - startTime);
                    while (TimeCost.calcStepArr.length > TimeCost.interval) {
                        TimeCost.calcStepArr.splice(0, 1);
                    }
                    this.cycles++;
                }

                // update the screen
                startTime = performance.now();
                Draw.mainSequence();
                endTime = performance.now();
                TimeCost.drawStepArr.push(endTime - startTime);
                while (TimeCost.drawStepArr.length > TimeCost.interval) {
                    TimeCost.drawStepArr.splice(0, 1);
                }
            }

            if (this.firstRefresh) {
                this.firstRefresh = false
                this.delta = 0
            }

            // play music
            // NOTE: music may stop playing suddenly and restart
            if (this.cycles % 15 === 0 && this.music != null) {
                let currentTime = this.music.currentTime
                if (this.lastCurrentTime == null) {
                    this.lastCurrentTime = currentTime;
                } else {
                    let deltaCT = currentTime - this.lastCurrentTime;
                    this.lastCurrentTime = currentTime;
                    // console.log(this.music.paused, Math.round(currentTime*1000)/1000, Math.round(deltaCT*1000)/1000)
                    if (timestamp > this.musicCooldown * 1000 && deltaCT === 0) {
                        console.log("MUSIC ERROR time:", currentTime)
                        this.music.currentTime = currentTime;
                    }
                }
            }
            if (this.music != null && timestamp > this.musicCooldown * 1000 && this.music.paused) {
                //console.log("MUSIC START");
                this.music.stop();
                this.lastCurrentTime = null;
                this.music.play();
                this.lastMusicPlayed = timestamp
            }

            // update InputHandler objects
            inp.updateInputHandlers();

            let fEndTime = performance.now();
            TimeCost.frameArr.push(fEndTime - fStartTime);
            while (TimeCost.frameArr.length > TimeCost.interval) {
                TimeCost.frameArr.splice(0, 1);
            }

            return 1;
        } catch (e) {
            console.log(`Error on cycle ${this.cycles}: `, e);
            return -1;
        }
    }
}

function getAvg(arr) {
    if (arr.length === 0) return null;
    let avg = 0;
    for (let i in arr) {
        avg += arr[i];
    }
    avg /= arr.length;
    return avg;
}

const Calculate = { // handles most of the calculation calls (runs exactly 60 times per second, if it takes longer than 1/60 of a second to run this step, the program can't keep up and will lag majorly)
    hasFocus: false,
    inputSequence: function (delta) {
        this.debugToggle();
        inp.moveMouse();
        if (!document.hasFocus()) {
            inp.unpressAll();
        }
        if (!this.hasFocus && document.hasFocus()) {
            console.log("focused");
        } else if (this.hasFocus && !document.hasFocus()) {
            console.log("unfocused");
        }
        this.hasFocus = document.hasFocus();
        this.interactInput();
        this.farSightToggle();
    },
    zoomInput: function() {
        if (inputs.zoomIn.pressed) {
            zoomTarget *= 21/20;
        }
        if (inputs.zoomOut.pressed) {
            zoomTarget *= 20/21;
        }
    },
    mainSequence: function (timestep) {
        SpatialSound.updateSoundPos();
        switch (MainLoop.activeScene) {
            case "title":
                this.title();
                break;
            case "game":
                this.gameSequence(timestep);
                break;
            case "end":
                this.endSequence();
                break;
        }
        Dialog.calc();
        InteractionText.calc();
        this.debugSequence();
    },
    bulletCycles: 0,
    gameSequence: function (timestep) {
        if (debug) this.zoomInput();
        s.stageCalc(MainLoop.cycles);
        // this.updateMapObjHitboxes();
        /*
        if (MapObject.utUpdate || MainLoop.cycles % 60 === 0) {
            MapObject.unloadTransfer();
            MapObject.utUpdate = false;
        }
        */
        if (Dialog.activeDialog == null)
            Enemy.enemyCalc();
        Player.move();
        this.zoom();
        this.movePlayerProjs();
        if (Dialog.activeDialog == null) {
            this.shootPlayerProj();
        }
        Button.updateButtons();
        Bridge.bridgeCalc();
        Trigger.triggerCalc(true);
        if (true || Dialog.activeDialog == null) { // MIGHT CHANGE IN FUTURE
            moveBullets();
            s.stageBullets(this.bulletCycles);
            this.bulletCycles++;
        }
        StageTrans.calc();
        Player.updateHealth();
    },
    title: function () {
        if (MainLoop.cycles > 240 && inputs.leftClick.initialPress) {
            let stageId;
            if (debugEnabled) stageId = window.prompt("enter stage id:", "0");
            else stageId = "1";
            try {
                // Stage.loadStage(stageId);
                MainLoop.activeScene = "game";
                StageTrans.startTrans(stageId);
                StageTrans.transCycles = 120;
                MainLoop.cycles = 0;
                /*let id = Object.keys(Music)[1 + Math.floor(Math.random() * 6)]
                Music.changeMusic(id)*/
            } catch(e) {
                console.log("Error loading stage:", e);
            }
            inputs.leftClick.initialPress = false;
        }
    },
    debugSequence: function () {
        if (consoleDebug && MainLoop.cycles % 60 === 0) {
            let mouseCoords = [
                inp.mouseCoords[0]/zoom+Player.camPos[0],
                -inp.mouseCoords[1]/zoom+Player.camPos[1]
            ]
            console.log("")
            console.log("mouseCoords:", mouseCoords);
            console.log("cycle:", MainLoop.cycles)
            //console.log(Object.keys(HitBox.objDict).length);

            console.log((Math.round(getAvg(MainLoop.fpsArr) * 1000) / 1000).toString(), "fps")

            let avgFrameTime = getAvg(TimeCost.frameArr) * 1000;
            let frameTime = "frame: " + (Math.round(avgFrameTime * 1000) / 1000).toString() + "μs (" + (Math.round(avgFrameTime / (1 / MainLoop.fps * 1000)) / 10).toString() + "% fps limit)"

            let inputStepTime = "input step: " + (Math.round(getAvg(TimeCost.inputStepArr) * 1000000) / 1000).toString() + "μs"

            let calcStepTime = "calc step: " + (Math.round(getAvg(TimeCost.calcStepArr) * 1000000) / 1000).toString() + "μs"

            let drawStepTime = "draw step: " + (Math.round(getAvg(TimeCost.drawStepArr) * 1000000) / 1000).toString() + "μs"

            //let loadedMOs = Object.keys(MapObject.objDict).length;
            //let unloadedMOs = Object.keys(MapObject.unloadedObjDict).length

            console.log(frameTime);
            console.log(inputStepTime, calcStepTime, drawStepTime);
            //console.log("map objs:", loadedMOs+unloadedMOs, " [loaded:", loadedMOs, "unloaded:", unloadedMOs.toString()+"]")
        }
    },
    endCycles: 0,
    endSequence: function() {
        this.endCycles++;
        if (this.endCycles >= 300 && inputs.leftClick.initialPress) {
            // RESET GAME
            MainLoop.cycles = 0;
            Stage.clearStage();
            this.endCycles = 0;
            MainLoop.activeScene = "title";
        }
    },
    /*
    updateMapObjHitboxes: function () {
        for (let id in MapObject.objDict) {
            let mo = MapObject.objDict[id];
            mo.updateColPos();
        }
    },*/
    /*
    updateMapObjAabb: function(unloaded=false) {
        for (let id in MapObject.objDict) {
            let mo = MapObject.objDict[id];
            mo.updateAabb();
        }
        if (unloaded) {
            for (let id in MapObject.unloadedObjDict) {
                let mo = MapObject.unloadedObjDict[id];
                mo.updateAabb();
            }
        }
    },*/
    zoom: function() {
        // change zoom
        zoom += (((Player.farSightMode)? zoomTarget/2 : zoomTarget) - zoom)*0.1;
        //if (zoom < 0.2) zoom = 0.2;
    },
    shootPlayerProj: function () {
        if (PlayerProj.reserveCount === 0) {
            PlayerProj.charge = 0;
        } else if (inputs.leftClick.pressed) {
            PlayerProj.charge += 1;
            if (PlayerProj.charge > 60) PlayerProj.charge = 60;
        } else {
            if (PlayerProj.charge >= 10) {
                //PlayerProj.projArr.push(new PlayerProj([Player.pos[0], -Player.pos[1]], ce.move([Player.moveVelo[0], -Player.moveVelo[1]], ce.dirToTarget([0,0], inp.mouseCoords), PlayerProj.charge/2)));
                let proj;
                for (let i = 0; i < PlayerProj.projArr.length; i++) {
                    if (!PlayerProj.projArr[i].thrown) {
                        proj = PlayerProj.projArr[i];
                        break;
                    }
                }
                Sound.sounds.shootOrb.play();
                proj.thrown = true;
                proj.velo = ce.flipY(ce.move([0, 0], Player.dir, PlayerProj.charge / 1.5));
                proj.hVelo = 2;
                PlayerProj.charge = 0;
            } else {
                PlayerProj.charge -= 3;
                if (PlayerProj.charge < 0) PlayerProj.charge = 0;
            }
        }
        if (debug && inputs.rightClick.initialPress) {
            PlayerProj.projArr.push(new PlayerProj([Player.pos[0], -Player.pos[1]], ce.move([Player.moveVelo[0], -Player.moveVelo[1]], ce.dirToTarget([0, 0], inp.mouseCoords), 25)));
            inputs.rightClick.initialPress = false;
        }
    },
    interactInput: function() {
        if (inputs.interact.initialPress) {
            if (Dialog.nextDialog()) return;
            Trigger.triggerCalc(false);
        }
    },
    farSightToggle: function() {
        if (inputs.farSight.initialPress) {
            Player.farSightMode = !Player.farSightMode;
        }
    },
    movePlayerProjs: function () {
        let rIndex = 0;
        let orbitIds = [];
        let enemyCollision = function (proj, yyHitCircle, damage, isAOE = false) {
            for (let eId in Enemy.eDict) {
                let e = Enemy.eDict[eId];
                let collided = false;
                for (let cId in e.colArr) {
                    let c = e.colArr[cId];
                    let colData = Collision.isTouching(yyHitCircle, c);
                    if (colData.overlap) {
                        collided = true;
                        break;
                    }
                    if (collided) break;
                }
                if (collided && !(e.orbAOEImmunity && isAOE)) {
                    if (damage > 10) Sound.sounds.projHit.play(ce.flipY(proj.pos));
                    e.health -= (debug)? damage*10 : damage;
                    proj.homing = false;
                }
            }
        }
        PlayerProj.projArr.forEach(function (proj, index) {
            let firstReserved = false;
            if (proj.thrown) { // projectile already thrown
                // attract towards closest enemy
                if (proj.homing && proj.height > 0 && Object.keys(Enemy.eDict).length > 0) {
                    // find closest
                    let closestEnemy = null;
                    let closestDistSqd = null;
                    for (let key in Enemy.eDict) {
                        let e = Enemy.eDict[key];
                        let distSqd = ce.distance(ce.flipY(proj.pos), e.pos, false);
                        if (closestDistSqd == null || distSqd < closestDistSqd) {
                            closestEnemy = e;
                            closestDistSqd = distSqd;
                        }
                    }

                    if (closestDistSqd <= 200 ** 2) {
                        // nudge velo towards closest
                        proj.velo = ce.move(proj.velo, ce.dirToTarget(proj.pos, ce.flipY(closestEnemy.pos)), 1);
                    }
                }

                // move orb
                for (let i = 0; i < 2; i++) {
                    proj.pos[i] += proj.velo[i];
                    proj.velo[i] *= (proj.height === 0) ? 0.8 : 0.98;
                }

                let yyHitCircle = new HitCircle(ce.flipY(proj.pos), 30, false, true)

                // enemy collision
                if (proj.height === 0) { // on ground
                    enemyCollision(proj, new HitCircle(ce.flipY(proj.pos), 150, false, true), 0.5, true);
                } else {// in air
                    enemyCollision(proj, yyHitCircle, (ce.distance([0, 0], proj.velo) ** 2) * 0.05);
                }

                // movement collision
                let oldPos = [proj.pos[0], proj.pos[1]];
                let moveCol = MapObject.moveCollision(ce.flipY(proj.pos), yyHitCircle, [Player.hc.id], ["river"]);
                proj.pos = ce.flipY(moveCol.pos);
                let collided = !moveCol.notCollided;

                // change velocity based on moveCol
                if (collided) {
                    let prevVelo = [proj.velo[0], proj.velo[1]]
                    proj.velo = Collision.bounce(ce.dirToTarget(oldPos, proj.pos), proj.velo, 0.75)
                    let veloChange = (proj.velo[0]-prevVelo[0])**2 + (proj.velo[1]-prevVelo[1])**2;
                    if (veloChange >= 10**2) {
                        Sound.sounds.wallHit.play(ce.flipY(proj.pos));
                    }
                }

                // height change
                proj.height += proj.hVelo;
                if (proj.height <= 0) {
                    proj.height = 0;
                    proj.hVelo = 0;
                    if (proj.groundTime <= 0) {
                        Sound.sounds.orbMagic.play(ce.flipY(proj.pos));
                        Sound.sounds.wallHit.play(ce.flipY(proj.pos));
                    }
                    proj.groundTime++;

                    // pickup detection
                    if (ce.distance(Player.pos, ce.flipY(proj.pos)) < 150) {
                        Sound.sounds.retrieveOrb.playDir(ce.dirToTarget(Player.pos, ce.flipY(proj.pos)));
                        proj.thrown = false;
                        PlayerProj.projArr.push(proj);
                        PlayerProj.projArr.splice(index, 1);
                    }
                } else {
                    proj.hVelo -= 0.1;
                    proj.groundTime = 0;
                }
            } else { // projectile in reserve
                proj.firstPickup = true;
                firstReserved = rIndex === 0;
                proj.groundTime = 0;
                if (firstReserved && !(PlayerProj.charge === 0 && inputs.sprint.pressed)) {
                    let targetDir = Player.dir;
                    let targetDist = 50;
                    let targetPos = ce.flipY(ce.move(Player.pos, targetDir, targetDist))
                    let targetSpeed = Math.sqrt(ce.distance(proj.pos, targetPos)) * 0.25;
                    proj.velo = ce.move(proj.velo, ce.dirToTarget(proj.pos, targetPos), targetSpeed)
                    for (let i = 0; i < 2; i++) {
                        proj.pos[i] += ((i === 0) ? 1 : -1) * Player.moveVelo[i];
                        proj.pos[i] += (targetPos[i] - proj.pos[i]) * 0.25
                        proj.velo[i] = 0;
                    }
                } else {
                    orbitIds.push(index);
                }
                proj.hVelo = 0;
                proj.height += (10 - proj.height) / 10;
                rIndex++;
            }
        });

        // apply forces to orbs
        for (let i in orbitIds) {
            let index1 = orbitIds[i];
            let proj1 = PlayerProj.projArr[index1];

            // repel orbs away from each other
            for (let j in orbitIds) {
                if (i === j) continue;
                let index2 = orbitIds[j];
                let proj2 = PlayerProj.projArr[index2];

                // use modified colomb's law
                const k = 100;
                const q = 15;
                const r = ce.distance(proj1.pos, proj2.pos) + 10;
                let force = k * q * q / r / r;
                proj1.velo = ce.move(proj1.velo, ce.dirToTarget(proj1.pos, proj2.pos) + 180, force);
            }

            // attract orbs towards player at far distances
            // repel orbs away from player at close distances

            const r = ce.distance(ce.flipY(Player.pos), proj1.pos) + 10;
            let force = 0.005 * Math.pow(r, 1.2) - 1000 / Math.pow(r, 1.5);
            proj1.velo = ce.move(proj1.velo, ce.dirToTarget(ce.flipY(Player.pos), proj1.pos) + 180, force);

            // push orb tangent to player for orbit
            let dir = ce.dirToTarget(ce.flipY(Player.pos), proj1.pos) + 90;
            proj1.velo = ce.move(proj1.velo, dir, 0.75);
        }

        // move orbiting orbs
        for (let i in orbitIds) {
            let proj = PlayerProj.projArr[orbitIds[i]]
            let distance = ce.distance(proj.pos, ce.flipY(Player.pos))
            let steps = Math.floor(ce.distance([0, 0], proj.velo) / 10)
            if (steps > 5) steps = 5;
            if (steps <= 0) steps = 1;
            if (distance > 1000) steps = 1;
            let collided = false;
            let sumVelo = [0, 0]
            for (let k = 0; k < steps; k++) {
                for (let j = 0; j < 2; j++) {
                    proj.pos[j] += proj.velo[j] / steps;
                    if (k === steps - 1) proj.velo[j] *= 0.95;
                }

                // enemy collision
                enemyCollision(proj, new HitCircle(ce.flipY(proj.pos), 30, false, true), (ce.distance([0, 0], proj.velo) ** 2) * 0.025 / steps);

                if (distance <= 1000) {
                    // movement collision
                    let prevPos = [proj.pos[0], proj.pos[1]];
                    let moveCol = MapObject.moveCollision(ce.flipY(proj.pos), new HitCircle(ce.flipY(proj.pos), 20, false, true), [Player.hc.id], ["river"]);
                    proj.pos = ce.flipY(moveCol.pos);
                    if (!collided) collided = !moveCol.notCollided;
                    let bounceVelo = Collision.bounce(ce.dirToTarget(proj.pos, prevPos), [proj.velo[0] / steps, proj.velo[1] / steps], 0.75)
                    sumVelo[0] += bounceVelo[0];
                    sumVelo[1] += bounceVelo[1];
                }
            }
            if (collided) {
                proj.velo = sumVelo;
            }
        }
    },
    debugToggle: function () {
        if (!debugEnabled) return;
        if (inputs.debug.initialPress) {
            debug = !debug;
        }
        if (inputs.consoleDebug.initialPress) {
            consoleDebug = !consoleDebug;
        }
    }
}

/* Scenes:
title
game
options
*/

const titleImg = new Image();
titleImg.src = "../graphics/title.png";

const grass = new Image();
grass.src = "../graphics/grasstile.png";

const purpleGrass = new Image();
purpleGrass.src = "../graphics/grasstile_purple.png";

const Draw = { // handles most rendering calls (may run less than 60 times per second depending on the lag)
    layers: ["floor", "obj", "enemy", "wall", "roof"],
    layerCanvases: {},
    grassVariant: 0,
    lastCycleGV: null,
    camCanvasOffset: function (ctx = null, doZoom=true) { // auto transforms canvas based on camPos
        if (ctx == null) ctx = c;
        let scale = (doZoom)? zoom : 1;
        ctx.transformCanvas(scale, 0, ce.screenDim[0] / 2 - Player.camPos[0]*scale, ce.screenDim[1] / 2+ Player.camPos[1]*scale)
    },
    mainSequence: function () { // render order
        this.resetCanvas();
        this.camHB = new HitBox([Player.camPos[0]-ce.screenDim[0]/2/zoom, Player.camPos[1]-ce.screenDim[1]/2/zoom], [ce.screenDim[0]/zoom, ce.screenDim[1]/zoom], false, true);
        switch (MainLoop.activeScene) {
            case "title":
                this.title();
                break;
            case "game":
                this.background();
                this.gameSequence();
                break;
            case "end":
                this.endSequence();
                break;
        }

        // GUI
        Dialog.draw();
        InteractionText.draw();
    },
    gameSequence: function () {
        //sh.drawShadows();
        this.mapObjects();
        this.drawLayerCanvas("floor");
        this.drawShadows();
        this.playerProjShadows();
        drawBulletShadows();
        this.drawEnemyShadows();
        RenderObj.draw();
        this.drawLayerCanvas("roof");
        // if (Player.farSightMode) this.farSightOverlay();
        this.drawEnemyHealthBars();
        c.resetTrans();
        s.stageDraw();

        // GUI
        this.damageVignette();
        if (debug) this.debugSequence();
        this.arrows();
        this.playerHealth();
        this.bossBar();
        StageTrans.draw();
        if (whiteOutAlpha > 0) this.whiteOut();

        // cursor
        this.cursor();
    },
    arrowImgs: {
        note: "../graphics/arrow/note.png",
        orb: "../graphics/arrow/orb.png",
        enemy: "../graphics/arrow/enemy.png",
    },
    initArrowImgs: function() {
        for (let key in Draw.arrowImgs) {
            let img = new Image();
            img.src = Draw.arrowImgs[key];
            Draw.arrowImgs[key] = img;
        }
    },
    arrows: function() { // draws indicator arrows
        let arrowArr = [];
        let createArrow = function(pos, type) {
            arrowArr.push({pos: pos, type: type})
        }
        // add note arrows
        for (let i = 0; i < noteArr.length; i++) {
            let mo = noteArr[i].mo;
            if (noteArr[i].read) continue;
            createArrow(mo.pos, "note");
        }

        // add orb arrows
        for (let i = 0; i < PlayerProj.projArr.length; i++) {
            let o = PlayerProj.projArr[i];
            if (o.groundTime === 0) continue;
            createArrow(ce.flipY(o.pos), "orb");
        }

        // add enemy arrows
        for (let id in Enemy.eDict) {
            let e = Enemy.eDict[id];
            if (e.dead) continue;
            createArrow(e.pos, "enemy");
        }

        // draw arrows
        c.resetTrans();
        for (let i = 0; i < arrowArr.length; i++) {
            let a = arrowArr[i];

            // check if off screen
            let onscreen = true;
            for (let j = 0; j < 2; j++) {
                if (Math.abs(a.pos[j]-Player.camPos[j])*zoom > ce.screenDim[j]*0.5) {
                    onscreen = false;
                    break;
                }
            }
            if (onscreen) continue;

            // size calculation
            let dist = ce.distance(a.pos, Player.pos);
            let size = 1 - (dist - 2000) / 1000;
            if (size <= 0) continue;
            if (size > 1) size = 1;

            // position calculations
            let dir = ce.dirToTarget(Player.camPos, a.pos);
            let seg = [[0,0], ce.move([0,0], dir, 10000)];
            let intPos = null;
            for (let j = 0; j < 4; j++) {
                let pA = [(ce.screenDim[0]*0.5-40) * ((Math.round(j/2) % 2) * 2 - 1), (ce.screenDim[1]*0.5-40) * ((Math.round((j+1)/2) % 2) * 2 - 1)]
                let pB = [(ce.screenDim[0]*0.5-40) * ((Math.round((j+1)/2) % 2) * 2 - 1), (ce.screenDim[1]*0.5-40) * ((Math.round((j+2)/2) % 2) * 2 - 1)]
                intPos = Collision.segIntersect(seg[0], seg[1], pA, pB, true);
                if (intPos != null) break;
            }
            if (intPos == null) continue;

            // draw to canvas
            c.save();
            if (intPos[0] < 0) {
                dir -= 180;
            }
            c.transformCanvas(size*0.2, -dir, ce.screenDim[0]*0.5 + intPos[0], ce.screenDim[1]*0.5 - intPos[1]);
            if (intPos[0] < 0) c.transform(-1, 0, 0, 1, 0, 0);
            c.fillCircle(0,0,10);
            let img = Draw.arrowImgs[a.type];
            c.drawImage(img, -img.width/2, -img.height/2);
            c.restore();
        }
    },
    debugSequence: function () { // draws debug stuff
        this.hitboxes();
        this.bounds();
        c.resetTrans();
        this.camCanvasOffset();
        c.fillStyle = "rgb(0,0,255)";
        /*
        c.globalAlpha = 0.5;
        c.fillCircle(Player.pos[0], -Player.pos[1],25);
        this.globalAlpha = 1;
        */
        this.testCanvas();
    },
    testCanvas: function () {
        if (s.testCanvas != null) {
            c.resetTrans();
            c.globalAlpha = 0.2;
            let hScale = ce.screenDim[0]/s.testCanvas.width;
            let vScale = ce.screenDim[1]/s.testCanvas.height;
            let scale = (hScale < vScale)? hScale : vScale;
            c.transformCanvas(scale, 0, 0, 0);
            c.transform(1,0,0,-1,0,0);
            c.drawImage(s.testCanvas, 0, -ce.screenDim[1]/scale);
        }
    },
    titleBg: null,
    titleCTB: null,
    title: function () {
        if (this.titleBg == null) {
            this.titleBg = new Image();
            this.titleBg.src = "../graphics/title_bg.png";
            this.titleCTB = new Image();
            this.titleCTB.src = "../graphics/click_to_begin.png";
        }
        c.resetTrans();
        let n = 120 - MainLoop.cycles;
        if (n < 0) n = 0;

        // title
        let scale = 0.5 + ((n/120) ** 0.5);
        function drawTitle() {
            c.transformCanvas(scale*zoom,0,
            ce.screenDim[0]/2-titleImg.width/2*scale*zoom, ce.screenDim[1]*zoom*-0.1);
            c.drawImage(titleImg, 0, 0);
            c.resetTrans();
        }

        // background
        if (n > 0) {
            drawTitle();
            c.globalCompositeOperation = "source-atop";
            c.fillStyle = "rgb(255,255,255)";
            c.fillRect(0, 0, ce.screenDim[0], ce.screenDim[1]);
            c.globalCompositeOperation = "destination-over";
            c.fillStyle = "rgb(0, 0, 0)";
            c.fillRect(0, 0, ce.screenDim[0], ce.screenDim[1]);
            c.globalCompositeOperation = "source-over";
        } else {
            // background image
            const scale = 1.6
            c.transformCanvas(scale, 0, ce.screenDim[0]/2+Math.cos(MainLoop.cycles/300)*300, ce.screenDim[1]/2+Math.sin(MainLoop.cycles/300)*300)
            c.drawImage(this.titleBg, -this.titleBg.width/2, -this.titleBg.height/2);
            c.resetTrans();

            // flash
            if (MainLoop.cycles < 180) {
                c.globalAlpha = 1 - (MainLoop.cycles - 120)/60;
                c.fillStyle = "rgb(255,255,255)";
                c.fillRect(0, 0, ce.screenDim[0], ce.screenDim[1]);
                c.globalAlpha = 1;
            }
            
            // title
            drawTitle();

            // click to begin text
            if (MainLoop.cycles > 240) {
                c.globalAlpha = 0.5+Math.sin((MainLoop.cycles-240)/15)*0.5
                const ctbScale = 0.5;
                c.transformCanvas(ctbScale,0,
                ce.screenDim[0]/2-this.titleCTB.width/2*ctbScale, ce.screenDim[1]*0.8);
                c.drawImage(this.titleCTB, 0, 0);
            }
        }
    },
    endSequence: function() {
        let ec = Calculate.endCycles;
        c.resetTrans();
        c.fillStyle = "rgb(0,0,0)"
        c.fillRect(0, 0, ce.screenDim[0], ce.screenDim[1]);
        if (ec > 180) {
            if (CreditText.canvas == null) {
                CreditText.createCanvas(MainLoop.cycles);
            }
            c.drawImage(CreditText.canvas, 0, ce.screenDim[1]/2-CreditText.canvas.height/2);
            if (ec < 300) {
                c.globalAlpha = 1-(ec-180)/120;
            }
        }
        if (ec < 300) {
            c.fillStyle = "rgb(255,255,255)"
            c.fillRect(0, 0, ce.screenDim[0], ce.screenDim[1]);
        }
    },
    resetCanvas: function () { // clears the canvases
        c.resetTrans();
        c.clearRect(0, 0, ce.screenDim[0], ce.screenDim[1]);
        for (let id in Draw.layerCanvases) {
            Draw.layerCanvases[id].getContext('2d').resetTrans();
            Draw.layerCanvases[id].getContext('2d').clearRect(0, 0, ce.screenDim[0], ce.screenDim[1]);
        }
    },
    updateBG: true,
    bgCanvas: null,
    background: function () { // draws background
        c.resetTrans();

        // static bg color
        c.fillStyle = "rgb(0,128,0)";
        c.fillRect(0, 0, ce.screenDim[0], ce.screenDim[1]);

        // scrolling grass
        let tileSize = 400;
        let lenDim = [9, 6];
        if (this.lastCycleGV != this.grassVariant) {
            this.updateBG = true;
            this.lastCycleGV = this.grassVariant;
        }
        if (this.updateBG) {
            this.updateBG = false;
            this.bgCanvas = ce.createCanvas((lenDim[0]*2+1)*tileSize, (lenDim[1]*2+1)*tileSize);
            let ctx = this.bgCanvas.getContext('2d');
            ctx.resetTrans();
            ctx.fillStyle = "rgb(0,0,0)";
            ctx.fillRect(0,0,this.bgCanvas.width,this.bgCanvas.height);
            let scale = 2;
            ctx.transformCanvas(scale, 0, 0, 0);
            for (let x = 0; x <= lenDim[0]*2; x++) {
                for (let y = 0; y <= lenDim[1]*2; y++) {
                    let pos = [x * tileSize, y * tileSize];
                    ctx.drawImage(((this.grassVariant === 0)? grass : purpleGrass), pos[0] / scale, pos[1] / scale)
                    ctx.rect(pos[0]/scale, pos[1]/scale, tileSize, tileSize);
                }
            }
        }

        // let offset = [-Player.camPos[0] % tileSize, Player.camPos[1] % tileSize]
        let offset = [Math.ceil(Player.camPos[0]/tileSize)*tileSize, Math.ceil(-Player.camPos[1]/tileSize)*tileSize]
        for (let i = 0; i < 2; i++) {
            if (offset[i] < 0) offset[i] += tileSize;
            offset[i] -= tileSize;
        }
        this.camCanvasOffset();
        //c.transformCanvas(zoom,0,ce.screenDim[0]/2/zoom-this.bgCanvas.width/2,ce.screenDim[1]/2/zoom-this.bgCanvas.height/2);
        c.drawImage(this.bgCanvas, offset[0]-this.bgCanvas.width/2, offset[1]-this.bgCanvas.height/2);
    },
    playerProjShadows: function () {
        PlayerProj.projArr.forEach(function (proj, index) {
            proj.drawShadow();
        });
    },
    loading: function () { // draws the load screen at the start
        c.resetTrans();
        c.fillStyle = "rgb(0,0,0)";
        c.fillRect(0,0,ce.screenDim[0],ce.screenDim[1]);
        c.transformCanvas(1, 0, ce.screenDim[0] / 2, ce.screenDim[1] / 2);
        c.font = "bold 200px Arial";
        c.textAlign = "center";
        c.fillStyle = "rgb(255,255,255)"
        c.fillText("Loading...", 0, 0)
        c.font = "50px Arial";
        c.fillText("Please reload or press 'p' if it takes longer than 30 seconds", 0, ce.screenDim[1]*0.1)
        let loadedSounds = 0;
        let totalSounds = 0;
        for (let s in Sound.sounds) {
            if (Sound.sounds[s].loadedMetadata) {
                loadedSounds++;
            }
            totalSounds++;
        }
        c.fillText(`Loaded Sounds: ${loadedSounds}/${totalSounds}`, 0, ce.screenDim[1]*0.2);
    },
    cursor: function () { // draws the cursor
        c.resetTrans();
        c.transformCanvas(1, 0, ce.screenDim[0] / 2 + inp.mouseCoords[0], ce.screenDim[1] / 2 + inp.mouseCoords[1] - ((inp.mouseDown)? 35 : 0));
        c.fillStyle = "rgb(255,255,255)";
        c.globalCompositeOperation = "difference";
        let mouseSize = (inp.mouseDown)? 10 : 5
        c.fillCircle(0, 0, mouseSize / c.canvasScale);
        if (PlayerProj.charge > 0) {
            c.beginPath();
            c.arc(0, 0, 20 / c.canvasScale, 0, Math.PI * 2 * PlayerProj.charge / 60);
            c.lineWidth = 5 / c.canvasScale;
            if (PlayerProj.charge === 60) {
                c.strokeStyle = "rgb(255,255,255)";
            } else if (PlayerProj.charge >= 10) {
                let color = ce.getColor((PlayerProj.charge - 10) / 50 / 4)
                c.strokeStyle = `rgb(${color.r},${color.g},${color.b})`
            } else {
                c.strokeStyle = "rgb(128,0,0)";
            }
            c.stroke();

            // draw range indicator
            // calculate time in air
            let vyi = 2
            let a = -0.1;
            let y = 10;
            let t = Math.ceil((-vyi-Math.sqrt(vyi**2-2*a*y))/a)+1;

            // calculate distance
            let vx = PlayerProj.charge / 1.5; // inital velocity
            let vf = vx*0.98**(t+1); // final velocity when hits ground
            let ma = 0.98; // velocity multiplier per frame while in air
            let mg = 0.8; // velocity multiplier per frame while on ground
            let ds = vf/(1-mg)*mg; // sliding distance
            let d = 1/(1-ma)*vx*(1-ma**(t+1)) + ds + 50; // total distance
            
            // draw indicator
            c.resetTrans();
            Draw.camCanvasOffset();
            c.fillStyle = "rgb(255,255,255)"
            let pos = ce.move(Player.pos, Player.dir, d);
            c.fillCircle(pos[0], -pos[1], 10);
        }
        c.globalCompositeOperation = "source-over";
    },
    mapObjects: function () { // renders the graphics of mapobjects onto the renderlayers
        c.resetTrans();
        
        // prepare layer canvases
        for (let i = 0; i < Draw.layers.length; i++) {
            let lCtx = Draw.layerCanvases[Draw.layers[i]].getContext('2d');
            lCtx.resetTrans();
            Draw.camCanvasOffset(lCtx);
        }

        // get mapobjects to render from BVH
        let canidates = BVH.getColCanidates(Draw.camHB);

        // draw mapobjects
        for (let i = 0; i < canidates.length; i++) {
            canidates[i].draw(1, ["obj", "wall"]);
        }
    },
    drawLayerCanvas(layer) {
        c.resetTrans();
        c.drawImage(Draw.layerCanvases[layer], 0, 0);
    },
    drawShadows() {
        c.resetTrans();
        c.globalAlpha = sh.shadowOpacity;
        sh.drawShadows(true, false);
        c.globalAlpha = 1;
    },
    hpbCanvas: ce.createCanvas(ce.screenDim[0], ce.screenDim[1]),
    drawEnemyShadows: function() {
        c.resetTrans();
        this.camCanvasOffset();
        c.globalAlpha = 0.5;
        c.fillStyle = "rgb(0,0,0)";
        for (let key in Enemy.eDict) {
            let e = Enemy.eDict[key];
            c.fillCircle(e.pos[0], -e.pos[1], 20*(1-e.deadTime/30));
        }
        c.globalAlpha = 1;
    },
    drawEnemyHealthBars: function () {
        let ctx = this.hpbCanvas.getContext('2d');
        ctx.resetTrans();
        ctx.clearRect(0,0,ce.screenDim[0],ce.screenDim[1]);
        this.camCanvasOffset(ctx);
        for (let id in Enemy.eDict) {
            let e = Enemy.eDict[id]
            let hbHeight = e.hbHeight;
            if (e.hideHP) continue;
            let length = 200;
            let y = -e.pos[1] - 5 - hbHeight;
            if (e.dead || e.health >= e.maxHealth) continue;
            ctx.fillStyle = "rgb(0,0,0)";
            ctx.fillRect(e.pos[0] - length/2 - 1.5, y - 3, length + 3, 16);
            let white = (e.health/e.maxHealth)*2.5-0.5;
            if (white > 1) white = 1;
            if (white < 0) white = 0;
            ctx.fillStyle = `rgb(255,${white*255},${white*255})`;
            ctx.fillRect(e.pos[0] - length/2 * e.health/e.maxHealth + 1.5, y, length * e.health/e.maxHealth - 3, 10)
            let segments = Math.floor(e.maxHealth / 10);
            if (segments <= 20) {
                ctx.fillStyle = "rgb(0,0,0)"
                for (let i = 0; i < segments-1; i++) {
                    ctx.fillRect(e.pos[0] - length/2 + (i+1)/segments * length - 1.5, y, 3, 10);
                }
            }
        }
        c.resetTrans();
        c.globalAlpha = 0.5;
        c.drawImage(this.hpbCanvas, 0, 0);
        c.globalAlpha = 1;
    },
    playerHealth() {
        c.resetTrans();
        const barOffset = [10,10];
        //if (Player.health >= Player.maxHealth && Player.regenPause === 0) return;
        c.transformCanvas(0.5, 0, barOffset[0], barOffset[1]);
        let opacity = 1-(Player.fullHealthTimer-60)/60
        if (opacity > 1) opacity = 1;
        else if (opacity < 0) opacity = 0;

        // render health bar image
        if (opacity > 0) {
            c.globalAlpha = opacity;
            c.drawImage(Player.healthBarImg, 0, 0);

            // draw health bar
            c.fillStyle = `rgb(255,${255*(1-Player.regenPause/30)},${255*(1-Player.regenPause/30)})`;
            c.fillRect(20*8, 6*8, 98*8*Player.health/Player.maxHealth, 8*8);
        }

        // draw damage segments
        for (let i = 0; i < Player.dmgSegArr.length; i++) {
            let seg = Player.dmgSegArr[i];
            c.globalAlpha = 1-seg.time/30;
            // c.fillStyle = `rgb(255,${255*c.globalAlpha},${255*c.globalAlpha})`;
            c.fillRect(20*8 + 98*8*seg.lowBound/Player.maxHealth, 6*8 + 100*(seg.time/30)**2, 98*8*seg.size/Player.maxHealth, 8*8);
        }

        /*
        c.fillStyle = "rgb(0,0,0)";
        c.fillRect(50-5,50-5,barDim[0]+10,barDim[1]+10);
        c.fillStyle = `rgb(255,${255*(1-Player.regenPause/30)},${255*(1-Player.regenPause/30)})`;
        c.fillRect(50,50,barDim[0]*(Player.health/Player.maxHealth)**1.5, barDim[1]);
        */
        c.globalAlpha = 1;
    },
    bossBar() {
        c.resetTrans();
        if (bossBarEnemyId == null) return;
        let bossBarEnemy = Enemy.eDict[bossBarEnemyId];
        const barDim = [800, 30];
        let fillProp = bossBarEnemy.health / bossBarEnemy.maxHealth;
        c.fillStyle = "rgb(0,0,0)";
        c.transformCanvas(1, 0, ce.screenDim[0]/2, ce.screenDim[1]-20)
        c.fillRect(-barDim[0]/2, 0, barDim[0], -barDim[1]);
        c.fillStyle = `rgb(255,${255*fillProp},${255*fillProp})`;
        c.fillRect(-barDim[0]/2+5, -5, (barDim[0]-10)*fillProp, -barDim[1]+10);
    },
    damageVignette: function() {
        c.resetTrans();
        let alpha = (1.5-Player.health*2/Player.maxHealth)
        if (alpha < 0) alpha = 0;
        alpha += Player.regenPause/30;
        if (alpha > 1) alpha = 1;
        alpha *= 0.95+0.05*Math.sin(MainLoop.cycles*Math.PI*2/30);
        let grad = c.createRadialGradient(ce.screenDim[0]/2, ce.screenDim[1]/2, 0, ce.screenDim[0]/2, ce.screenDim[1]/2, ce.distance([0,0], ce.screenDim)/2);
        grad.addColorStop(0.5, "rgba(128,0,0,0)");
        grad.addColorStop(1, `rgba(255,0,0,${alpha})`);
        c.fillStyle = grad;
        c.fillRect(0,0,ce.screenDim[0], ce.screenDim[1])
    },
    whiteOut: function() {
        c.resetTrans();
        c.globalAlpha = whiteOutAlpha;
        c.fillStyle = "rgb(255,255,255)";
        c.fillRect(0, 0, ce.screenDim[0], ce.screenDim[1]);
        c.globalAlpha = 1;
    },
    farSightOverlay() {
        c.resetTrans();
        c.globalAlpha = 0.25;
        c.fillStyle = "rgb(255,255,255)";
        c.fillRect(0,0,ce.screenDim[0],ce.screenDim[1]);
        c.globalAlpha = 1;
        c.globalCompositeOperation = "overlay";
        c.fillStyle = "rgb(0,0,0)"
        c.fillRect(0,0,ce.screenDim[0],ce.screenDim[1]);
        c.globalCompositeOperation = "source-over";
    },
    hitboxes: function () {
        c.resetTrans();
        this.camCanvasOffset();
        let color = ce.getColor(MainLoop.cycles / 120);
        c.fillStyle = `rgb(${color.r},${color.g},${color.b})`;
        c.globalAlpha = 0.5;
        let canidates = BVH.getColCanidates(this.camHB);
        for (let id in Enemy.eDict) {
            canidates.push(Enemy.eDict[id]);
        }
        for (let id in Trigger.objDict) {
            canidates.push(Trigger.objDict[id]);
        }
        for (let i = 0; i < canidates.length; i++) {
            let mo = canidates[i];
            for (let j = 0; j < mo.colArr.length; j++) {
                let col = mo.colArr[j];
                if (!col.enabled && !(col.trigger && col.tObj.enabled)) continue;
                if (col.type === "box") {
                    c.fillRect(col.pos[0], -col.pos[1], col.dim[0], -col.dim[1])
                } else if (col.type === "circle") {
                    c.fillCircle(col.pos[0], -col.pos[1], col.radius)
                }
            }
        }
        c.globalAlpha = 1;
    },
    bvhLevelArr: null,
    bounds: function() {
        c.resetTrans();
        this.camCanvasOffset();
        c.lineWidth = 5;

        // map object bounds
        c.strokeStyle = "rgb(255,255,255)";
        c.beginPath();
        let canidates = BVH.getColCanidates(this.camHB);
        for (let i = 0; i < canidates.length; i++) {
            let mo = canidates[i];
            c.rect(mo.aabb[0], -mo.aabb[1], mo.aabb[2]-mo.aabb[0], -mo.aabb[3]+mo.aabb[1]);
        }
        c.stroke();

        // bounding volume heirarchy bounds
        if (this.bvhLevelArr == null) {
            let levelArr = []; // stores rectangles on each level to be rendered
            let bvhRecursive = function(node, level) {
                // recursion
                if (node.parentNode) {
                    for (let i = 0; i < node.children.length; i++) {
                        bvhRecursive(node.children[i], level+1, levelArr);
                    }
                }
                
                // add aabb to levelArr
                while (levelArr.length < level+1) {
                    levelArr.push([]);
                }
                levelArr[level].push([node.aabb[0], node.aabb[1], node.aabb[2], node.aabb[3]]);
            }
            c.strokeStyle = "rgb(255,0,0)";
            bvhRecursive(BVH.topNode, 0);
            this.bvhLevelArr = levelArr;
        }

        // draws bvh
        for (let i = 0; i < this.bvhLevelArr.length; i++) {
            let level = this.bvhLevelArr[i];
            let color = ce.getColor(i/10);
            c.setLineDash([100/(i+5), 500/(i+5)]);
            c.strokeStyle = `rgb(${color.r},${color.g},${color.b})`;
            c.beginPath();
            for (let j = 0; j < level.length; j++) {
                let rect = level[j];
                // check if in screen
                let screenBounds = [
                    Player.camPos[0]-ce.screenDim[0]/zoom/2,
                    Player.camPos[1]-ce.screenDim[1]/zoom/2,
                    Player.camPos[0]+ce.screenDim[0]/zoom/2,
                    Player.camPos[1]+ce.screenDim[1]/zoom/2,
                ];
                // check if out of loaded aabb
                let onScreen = true;
                for (let k = 0; k < 2; k++) {
                    if (rect[k+2] < screenBounds[k]) {
                        onScreen = false;
                        break;
                    }
                    if (rect[k] > screenBounds[k+2]) {
                        onScreen = false;
                        break;
                    }
                }
                if (onScreen)
                    c.rect(rect[0], -rect[1], rect[2]-rect[0], -rect[3]+rect[1]);
            }
            c.stroke();
        }
        c.setLineDash([]);
    },
}
for (let i in Draw.layers) {
    let id = Draw.layers[i];
    Draw.layerCanvases[id] = ce.createCanvas(ce.screenDim[0], ce.screenDim[1])
}
Draw.layerCanvases["proj"] = ce.createCanvas(ce.screenDim[0], ce.screenDim[1])
Draw.layerCanvases["hiddenProj"] = ce.createCanvas(ce.screenDim[0], ce.screenDim[1])

window.onload = function () {
    console.log("Start")
    c.resizeCanvas();
    Sound.initSounds();

    // load audio and wait for mainLoop to initialize
    const load = setInterval(function () {
        let ready = true;
        for (let s in Sound.sounds) {
            if (!Sound.sounds[s].loadedMetadata) {
                ready = false;
            }
        }
        if (ready || inputs.loadOverride.initialPress) {
            try {
                Enemy.loadEnemies();
                Player.init();
                PlayerProj.init();
                Char.initLetters();
                StageTrans.init();
                Draw.initArrowImgs();
                BVH.topNode = new BVH([]);
            } catch (e) {
                console.log(`Error on startup: ${e}`)
                clearInterval(load);
            }
            clearInterval(load);
            Music.changeMusic("title");
            MainLoop.activeScene = "title";
            requestAnimationFrame(animationFrame);
        } else {
            c.resizeCanvas();
            Draw.loading();
        }
    }, 10)
}

function animationFrame(timestamp) {
    if (MainLoop.run(timestamp) === -1) return;
    requestAnimationFrame(animationFrame)
}