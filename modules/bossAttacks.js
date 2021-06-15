import {MBullet, spawnRing, spawnBullet} from "./bullets.js";
import * as mod from "./bulletMods.js";
import {Enemy, shot} from "./enemy.js";
import {Player, PlayerProj} from "./player.js";
import {Collision, HitCircle, HitBox} from "./collisions.js";
import {Graphic, MapObject} from "./mapObj.js";
import {MainLoop} from "./main.js";
import * as ce from './canvasExtension.js';
import {Sound} from "./audio.js";
import {healBoss} from './stage.js';
import {InteractionText} from './dialog.js';

function base(phaseNum, cycles, coreSpires) {
    // spawn slow moving bullets from spire (based on color of core)
    if (cycles % ((phaseNum === 3)? 1 : 60) === 0) {
        let color;
        switch (phaseNum) {
            case 0: // purple core
                color = [255,0,255];
                break;
            case 1: // aqua core
                color = [0,255,255];
                break;
            case 2: // red core
                color = [255,0,0];
                break;
            case 3: // rainbow core
                color = ce.getColor(Math.random(), true);
                break;
            default:
                color = [255,255,255];
        }
        for (let id in coreSpires) {
            let cs = coreSpires[id];
            shot.tap.play(cs.pos)
            if (phaseNum === 3) {
                let speed = 15+Math.random()*15
                spawnBullet(new MBullet(false, {
                    pos: [cs.pos[0], cs.pos[1]],
                    dir: Math.random()*360,
                    speed: speed,
                    type: MBullet.types.orb,
                    color: color,
                    size: 1+Math.random()*2,
                    damage: 10,
                    ignoreWalls: true,
                }, [
                    mod.moveAccel(-speed/40, speed/4),
                    mod.moveTimer(120)
                ]))
            } else {
                spawnRing(new MBullet(false, {
                    pos: [cs.pos[0], cs.pos[1]],
                    dir: Math.random()*360,
                    speed: 20,
                    type: MBullet.types.orb,
                    color: color,
                    size: 3,
                    damage: 10,
                    ignoreWalls: true,
                }, [
                    mod.moveAccel(-0.5, 5),
                    mod.moveTimer(120)
                ]), 8)
            }
        }
    }
}

let phaseA = function(cycles, coreSpires, corePos) {
    // star burst bullets
    spireArr = [];
    if (cycles % 60 === 0) {
        for (let id in coreSpires) {
            let cs = coreSpires[id];
            shot.bump.play(cs.pos);
            let dir = Math.random()*360;
            for (let i = 0; i < 5; i++) {
                spawnRing(new MBullet(false, {
                    pos: [cs.pos[0], cs.pos[1]],
                    dir: dir,
                    speed: 20,
                    type: MBullet.types.star,
                    color: [0,0,255],
                    size: 4,
                    damage: 15,
                    ignoreWalls: true,
                }, [
                    mod.moveAccel(-0.5, 10, i*10),
                    mod.moveTimer(180),
                    mod.moveSpin(3)
                ]), 3)
            }
        }
    }

    // red orbs that explode into smaller rice bullets
    if (cycles % 120 === 0) {
        for (let id in coreSpires) {
            let cs = coreSpires[id];
            shot.slam.play(cs.pos);
            //if (ce.distance(cs.pos, Player.pos, false) > 3000**2) continue;
            // giant red orb
            spawnBullet(new MBullet(false, {
                pos: [cs.pos[0], cs.pos[1]],
                dir: null,
                speed: 30,
                type: MBullet.types.ball,
                color: [255,0,0],
                size: 5,
                damage: 5,
                destroyable: false,
            }, [
                mod.moveAccel(-0.5, 10),
                mod.moveIntervalFunction(function(self) {
                    // giant orb explosive fragments
                    shot.blast.play(self.pos);
                    for (let i = 0; i < 2; i++) {
                        spawnRing(new MBullet(false, {
                            pos: [self.pos[0], self.pos[1]],
                            dir: null,
                            speed: 30,
                            type: MBullet.types.rice,
                            color: [255,0,0],
                            damage: 20,
                            size: 5
                        }, [
                            mod.moveTimer(60),
                            mod.moveAccel(-0.5, 0),
                            mod.moveRot((i-0.5)*2)
                        ]), 5)
                    }
                    self.alive = false;
                }, null, 90+Math.floor(Math.random()*30)),
                mod.moveIntervalFunction(function(self) {
                    // trailing stationary orbs that explode
                    let idleTime = 60+Math.floor(Math.random()*240);
                    spawnBullet(new MBullet(false, {
                        pos: [self.pos[0], self.pos[1]],
                        dir: (Math.random() < 0.25)? ce.dirToTarget(self.pos, Player.pos) : null,
                        speed: 0,
                        type: MBullet.types.orb,
                        color: [255,128,0],
                        damage: 10,
                        size: 2,
                        ignoreWalls: true,
                    }, [
                        mod.moveIntervalFunction(function(self) {
                            // trailing orb explosive fragments
                            shot.tap.play(self.pos);
                            spawnRing(new MBullet(false, {
                                pos: [self.pos[0], self.pos[1]],
                                dir: null,
                                speed: 0,
                                type: MBullet.types.rice,
                                color: [255,255,0],
                                damage: 10,
                                size: 2,
                                ignoreWalls: true,
                            }, [
                                mod.moveAccel(0.2, 10),
                                mod.moveTimer(120)
                            ]), 5)
                            self.alive = false;
                        }, null, idleTime)
                    ]))
                }, 15, 15)
            ]))
        }
    }
}

let spireArr = [];
function spawnSpire(pos, coreSpires) {
    let spire = new Enemy([pos[0], pos[1]], 100, [
        // collision arr
        new HitCircle([0,0], 13*4, true, false)
    ], {
        // graphic dict
        still: new Graphic("mini_spire", ["enemy"], ".png", 0.5, 2, 8, [16*8, -13*4, 13*4])
    }, function(self, cycles) {
        // move funct
    }, function(self, cycles) {
        // bullet funct
        if (cycles % 120 === 0) { // periodic rings
            spawnRing(new MBullet(false, {
                pos: [self.pos[0], self.pos[1]],
                dir: Math.random()*360,
                speed: 20,
                type: MBullet.types.orb,
                color: [255,0,255],
                size: 2,
                damage: 10,
                ignoreWalls: true,
            }, [
                mod.moveAccel(-0.5, 5),
                mod.moveTimer(120)
            ]), 16)
        }

        // glowing effect
        if (cycles % 3 === 0) {
            let light = 200+Math.random()*55;
            spawnBullet(new MBullet(false, {
                pos: [self.pos[0], self.pos[1]-1],
                dir: 0,
                speed: 0,
                type: MBullet.types.ball,
                color: [255,light,255],
                size: 3,
                shadow: false,
                height: 62*4+1,
                indicator: true,
                alpha: 0.5,
            }, [
                mod.moveIntervalFunction(function(self) {
                    self.size += (1.5 - self.size)*0.01;
                }, 0, 0),
                mod.moveTimer(30)
            ]))
        }

        // healing orbs
        if (cycles % 12 === 0) {
            // find closest spire
            let start = [self.pos[0], self.pos[1]]
            let closest = null;
            for (let id in coreSpires) {
                let cs = coreSpires[id];
                if (closest == null || ce.distance(cs.pos, start, false) < ce.distance(closest.pos, start, false)) {
                    closest = cs;
                }
            }
            let target = closest.pos;
            let dist = ce.distance(start, closest.pos);
            let steps = Math.ceil(dist/20);

            // spawn healing orbs
            spawnBullet(new MBullet(false, {
                pos: [start[0], start[1]],
                dir: ce.dirToTarget(self.pos, target),
                speed: dist/steps,
                type: MBullet.types.ball,
                color: [255,128,255],
                size: 3,
                indicator: true,
                height: 62*4,
                alpha: 0.9,
            }, [
                mod.moveIntervalFunction(function(self) {
                    // heal spires
                    healBoss(2);
                }, 0, steps),
                mod.moveTimer(steps)
            ]));
        }
    }, "still", false, undefined, undefined, undefined, 250);
    spireArr.push(spire);
}

let phaseB = function(cycles, coreSpires, corePos) {
    // spawn spires
    if (cycles === 1) {
        // spawn healing spires
        let amount = 12;
        for (let i = 0; i < amount; i++) {
            spawnSpire(ce.move(corePos, i*360/amount, 2500), coreSpires);
        }
    }

    // spawn attack orbs
    if (cycles % 300 >= 240 && cycles % 6 === 0) {
        let color = Math.random()*255;
        for (let id in coreSpires) {
            let cs = coreSpires[id];
            Enemy.s.bump.play(cs.pos);
            let dir = null;
            if (ce.distance(cs.pos, Player.pos, false) <= 2000**2) {
                dir = ce.dirToTarget(cs.pos, Player.pos) + (Math.random()*2-1)*45;
            }
            spawnBullet(new MBullet(false, {
                pos: [cs.pos[0], cs.pos[1]],
                dir: dir,
                speed: 20,
                type: MBullet.types.bubble,
                color: [0,color,255],
                size: 1,
                damage: 20,
                ignoreWalls: true,
            }, [
                mod.moveAccel(-0.1, 5),
                mod.moveIntervalFunction(function(self) {
                    if (ce.distance(self.pos, Player.pos, false) > 350**2)
                        return;
                    Enemy.s.slam.play(self.pos);
                    for (let i = 0; i < 10; i++) {
                        let speed = 5+Math.random()*5;
                        spawnBullet(new MBullet(false, {
                            pos: [self.pos[0], self.pos[1]],
                            dir: Math.random()*360,
                            speed: speed*2,
                            type: MBullet.types.orb,
                            color: [0,color,255],
                            size: 2,
                            damage: 5,
                            ignoreWalls: true,
                        }, [
                            mod.moveAccel(-speed/15, speed),
                            mod.moveTimer(90+Math.floor(30*Math.random())),
                        ]));
                    }

                    for (let i = 0; i < 3; i++) {
                        spawnBullet(new MBullet(false, {
                            pos: [self.pos[0], self.pos[1]],
                            dir: ce.dirToTarget(self.pos, Player.pos),
                            speed: 10+i*5,
                            type: MBullet.types.rice,
                            color: [0,255,0],
                            size: 3,
                            damage: 10,
                            ignoreWalls: true,
                        }, [
                            mod.moveTimer(120+i*5)
                        ]));
                    }
                    self.alive = false;
                }, 0, 0),
            ]))
        }
    }
}

let phaseC = function(cycles, coreSpires, corePos) {
    if (cycles === 1) {
        // spawn mini spires (removed because too hard)
        let amount = 4;
        killMiniSpires();
        /*
        for (let i = 0; i < amount; i++) {
            spawnSpire(ce.move(corePos, i*360/amount, 2500), coreSpires);
        }
        */

        // spawn planetary orbs rotating around arena
        const k = 0.02;
        const x0 = 300;
        const maxDist = 2000;
        let riSpawned = false;
        for (let id in coreSpires) {
            let cs = coreSpires[id];
            let startingDist = ce.distance(cs.pos, corePos);

            // spawn ring indicators
            if (!riSpawned) {
                riSpawned = true;
                spawnRing(new MBullet(false, {
                    pos: [corePos[0], corePos[1]],
                    dir: 0,
                    speed: (startingDist+maxDist)/30,
                    type: MBullet.types.ball,
                    color: [255,255,0],
                    size: 5,
                    damage: 1,
                    destroyable: false
                }, [
                    mod.moveTimer(480),
                    mod.moveIntervalFunction(function(self) {
                        self.speed = 0;
                        spawnBullet(new MBullet(false, {
                            pos: [self.pos[0], self.pos[1]],
                            dir: ce.dirToTarget(self.pos, corePos)+Math.random()*180+90,
                            speed: 10+Math.random()*10,
                            type: MBullet.types.orb,
                            color: [255,0,0],
                            size: 2,
                            damage: 5,
                            ignoreWalls: true
                        }, [
                            mod.moveTimer(60)
                        ]))
                    }, 5, 30),
                ]), 180)
            }

            // spawn planetary bullet
            Sound.sounds.coreCannonBlast.play(cs.pos);
            spawnBullet(new MBullet(false, {
                pos: [corePos[0], corePos[1]],
                dir: ce.dirToTarget(cs.pos, corePos)+180,
                speed: 0,
                type: MBullet.types.ball,
                color: [255,0,0],
                size: 15,
                destroyable: false,
                damage: 1000,
            }, [
                mod.moveRot(0, 0.0025, 3, 0, true),
                mod.moveIntervalFunction(function(self) {
                    self.modArr[0].distance = maxDist / (1 + Math.E ** ((-k) * (self.aliveTime - x0))) + startingDist;
                }),
                mod.moveIntervalFunction(function(self) {
                    // distance dependent shaking
                    let distance = ce.distance(self.pos, Player.pos)
                    if (Player.shakeCycle != MainLoop.cycles) {
                        Player.shakeMulti = 0;
                        Player.shakeCycle = MainLoop.cycles;
                    }
                    let shakeMulti = 2000/(10+(distance/150)**2);;
                    if (Player.shakeMulti < shakeMulti)
                        Player.shakeMulti = shakeMulti;
                }, 0, 0),
                mod.moveIntervalFunction(function(self) {
                    Sound.sounds.earhurt.play(self, undefined, true);
                }, 120, 0),
                mod.moveIntervalFunction(function(self) {
                    // spawn trailing bullets
                    spawnBullet(new MBullet(false, {
                        pos: ce.move(self.pos, Math.random()*360, 150),
                        dir: Math.random()*360,
                        speed: 0,
                        type: MBullet.types.rice,
                        color: [255,Math.random()*255,0],
                        size: 10,
                        damage: 15,
                        ignoreWalls: true,
                    }, [
                        mod.moveTimer(180+Math.random()*120),
                        mod.moveAccel(0.02, 5),
                        mod.moveIntervalFunction(function(self) {
                            // change size
                            self.size += (2 - self.size)*0.01
                        }, 0, 0)
                    ]))
                }),
                // spawn attack bullets
                mod.moveIntervalFunction(function(self) {
                    let color = [255,Math.random()*255,0];
                    spawnBullet(new MBullet(false, {
                        pos: [self.pos[0], self.pos[1]],
                        dir: ce.dirToTarget(self.pos, corePos) + (Math.random()*2-1)*45,
                        speed: 0,
                        type: MBullet.types.ball,
                        color: color,
                        size: 5,
                        damage: 5,
                        destroyable: false
                    }, [
                        mod.moveAccel(0.1, 15),
                        mod.moveIntervalFunction(function(self) {
                            // spawn explosive bullet indicator ring
                            spawnRing(new MBullet(false, {
                                pos: [self.pos[0], self.pos[1]],
                                speed: 5,
                                type: MBullet.types.orb,
                                color: color,
                                size: 1,
                                indicator: true,
                                alpha: 0.5,
                            }, [
                                mod.moveAccel(-0.1, 1),
                                mod.moveTimer(120),
                            ]), 20)
                            // spawn explosive bullet indicator center
                            spawnBullet(new MBullet(false, {
                                pos: [self.pos[0], self.pos[1]],
                                speed: 0,
                                type: MBullet.types.bubble,
                                color: color,
                                size: 1,
                                indicator: true,
                                alpha: 0.8,
                            }, [
                                // change size
                                mod.moveIntervalFunction(function(self) {
                                    self.size += self.size*0.01
                                }, 0, 30),
                                // spawn explosive bullet
                                mod.moveReplaceBulletTimer(120, new MBullet(false, {
                                    pos: [0,0],
                                    type: MBullet.types.ball,
                                    dir: null,
                                    speed: 0,
                                    damage: 10,
                                    destroyable: false,
                                    color: color,
                                    size: 20
                                }, [
                                    // spawn explosive bullet frags
                                    mod.moveIntervalFunction(function(self) {
                                        for (let i = 0; i < 50; i++) {
                                            let speed = 5+Math.random()*5;
                                            spawnBullet(new MBullet(false, {
                                                pos: [self.pos[0],self.pos[1]],
                                                type: MBullet.types.orb,
                                                dir: Math.random()*360,
                                                speed: speed*2,
                                                damage: 5,
                                                color: color,
                                                size: 1+Math.random(),
                                                ignoreWalls: true,
                                            }, [
                                                mod.moveTimer(30+Math.floor(Math.random()*31)),
                                                mod.moveAccel(-speed/30, speed)
                                            ]))
                                        }
                                    }, 100, 0),
                                    mod.moveTimer(15)
                                ]), 1, true, true, shot.slam)
                            ]))
                        }, 60, 120),
                        mod.moveIntervalFunction(function(self) {
                            // test if out of bounds
                            let distSqd = ce.distance(self.pos, corePos, false);
                            if (distSqd > (startingDist+maxDist)**2) self.alive = false;
                        }, 10, 120)
                    ]))
                }, 90, 600),
            ]))
        }
    }
}

let phaseD = function(cycles, coreSpires) {
    for (let i = 0; i < spireArr.length; i++) {
        spireArr[i].health = 0;
    }
}

let phaseFuncts = [phaseA, phaseB, phaseC, phaseD];
export function bossAttack(phaseNum, cycles, coreSpires, corePos) {
    base(phaseNum, cycles, coreSpires, corePos);
    phaseFuncts[phaseNum](cycles, coreSpires, corePos);
    // update spireArr
    for (let i = spireArr.length-1; i >= 0; i--) {
        if (spireArr[i].dead) {
            spireArr.splice(i,1);
        }
    }
    if (spireArr.length > 0) {
        InteractionText.setText("Destroy the spirit recovery spires");
    }
}

export function killMiniSpires() {
    for (let i = 0; i < spireArr.length; i++) {
        spireArr[i].health = 0;
    }
}