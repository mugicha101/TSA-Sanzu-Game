import {MBullet, spawnRing, spawnBullet} from "./bullets.js";
import {Player, PlayerProj} from "./player.js";

// accelerates the speed of a bullet
// CHANGED TO HELPER FUNCTION FOR moveIntervalFunction
export function moveAccel(accelAmount, speedCap=null, initialDelay=0) {
    // return ["Accel", accelAmount, speedCap]
    return moveIntervalFunction(function(self) {
        self.speed += accelAmount;
        if (Math.sign(accelAmount)*self.speed > Math.sign(accelAmount)*speedCap) {
            self.speed = speedCap;
        }
    }, 1, initialDelay)
}

// rotates a bullet around an origin
export function moveRot(rotSpeed, rotAccel=0, rotSpeedCap=null, startDist=0, tidalLocked=false) {
    return {
        type: "rot",
        rotSpeed: rotSpeed,
        rotAccel: rotAccel,
        rotSpeedCap: rotSpeedCap,
        distance: startDist,
        tidalLocked: tidalLocked
    }
}

// runs a function at a set interval timer (if time is null, only runs once. if repeatDelay is 0 or 1, repeats every cycle.)
// function field is self (references the bullet the mod is on)
export function moveIntervalFunction(funct, repeatDelay = 0, initialDelay = 0) {
    if (repeatDelay <= 0) repeatDelay = 1;
    return {
        type: "itvFunct",
        repDelay: repeatDelay,
        initDelay: initialDelay,
        funct: funct,
        runCount: 0,
    }
}

// grows a bullet to a set size (can be linear or increase size by difference*rate every frame)
// REPLACED BY moveIntervalFunction
/*
export function moveGrow(targetSize, rate=0.1, isLinear=false) {
    return ["Grow", targetSize, rate, isLinear]
}
*/

// deletes bullet after a set amount of time
// CHANGED TO HELPER FUNCTION FOR moveIntervalFunction
export function moveTimer(time) {
    // return ["Timer", time]
    return moveIntervalFunction(function(self) {
        self.alive = false;
    }, null, time)
}

// add mod at specified time
// CHANGED TO HELPER FUNCTION FOR moveIntervalFunction
export function moveAddModTimer(time, modArr) {
    // return ["AddDataTimer", time, moveDataList]
    return moveIntervalFunction(function(self) {
        for (let i in modArr) {
            self.modArr.push(modArr[i])
        }
    }, null, time)
}

// change mod at specified time
// CHANGED TO HELPER FUNCTION FOR moveIntervalFunction
// funct has a field to reference the mod being edited
export function moveChangeModTimer(time, modType, changeFunct) {
    // return ["ChangeDataTimer", time, type, typeIndex, newValue, isAdd]
    return moveIntervalFunction(function(self) {
        for (let i in self.modArr) {
            let mod = self.modArr[i];
            if (mod.type.toLowerCase === modType.toLowerCase) {
                changeFunct(mod);
            }
        }
    }, null, time);
}

// delMoveData at specified time
// CHANGED TO HELPER FUNCTION FOR moveIntervalFunction
export function moveDelDataTimer(time, type) {
    // return ["DelDataTimer", time, type]
    return moveIntervalFunction(function(self) {
        for (let i = 0; i < self.modArr.length; i++) {
            let mod = self.modArr[i];
            if (mod.type.toLowerCase === modType.toLowerCase) {
                self.modArr.splice(i, 1);
                i--;
            }
        }
    }, null, time);
}

// replace bullet's modArr with specified modArr at specified time
// CHANGED TO HELPER FUNCTION FOR moveIntervalFunction
export function moveReplaceModsTimer(time, newModArr) {
    // return ["ReplaceDataTimer", time, newData]
    return moveIntervalFunction(function(self) {
        for (let i = 0; i < self.modArr.length; i++) {
            let mod = self.modArr[i];
            if (mod.type.toLowerCase === modType.toLowerCase) {
                self.modArr.splice(i, 1);
                i--;
            }
        }
    }, null, time);
}


// change bullet direction at specified time
// REPLACED BY moveIntervalFunction
/*
export function moveChangeDirTimer(time, newDir, isAdd=false) {
    return ["ChangeDirTimer", time, newDir, isAdd]
}
*/

// change bullet speed at specified time
// REPLACED BY moveIntervalFunction
/*
export function moveChangeSpeedTimer(time, newSpeed, isAdd=false) {
    return ["ChangeSpeedTimer", time, newSpeed, isAdd]
}
*/

// change bullet's rgbArr at specified time
// REPLACED BY moveIntervalFunction
/*
export function moveChangeColorTimer(time, newRgbArr, isAdd=false) {
    return ["ChangeColorTimer", time, newRgbArr, isAdd]
}
*/

// change bullet size at specified time
// REPLACED BY moveIntervalFunction
/*
export function moveChangeSizeTimer(time, newSize, isAdd=false) {
    return ["ChangeSizeTimer", time, newSize, isAdd]
}
*/

// replace bullet with specified bullet(s) at specified time (if isRelative, new Bullet dir are relative to parent bullet. bullet pos is always relative regardless of isRelative), if dir is null, chooses a random dir
// CHANGED TO HELPER FUNCTION FOR moveIntervalFunction
export function moveReplaceBulletTimer(time, newBullet, amount=1, relativePos=true, relativeDir=true, sound=null, soundVolumeMulti=1) {
    // return ["ReplaceBulletTimer", time, newBullet, isRelative, amount]
    return moveIntervalFunction(function(self) {
        if (sound != null) sound.play(self.pos, soundVolumeMulti);
        spawnBulletHelper(self, newBullet, amount, relativeDir)
        self.alive = false;
    }, null, time)
}

// spawns bullets at a set interval timer (if time is null, only spawns once)
// CHANGED TO HELPER FUNCTION FOR moveIntervalFunction
export function moveSpawnBulletTimer(repeatDelay, initialDelay, newBullet, amount=1, relativePos=true, relativeDir=true, sound=null, soundVolumeMulti=1) {
    // return ["SpawnBulletTimer", repeatDelay, initialDelay, newBullet, isRelative, amount, 0]
    return moveIntervalFunction(function(self, count) {
        if (sound != null) sound.play(self.pos, soundVolumeMulti);
        spawnBulletHelper(self, newBullet, amount, relativeDir, relativePos)
    }, repeatDelay, initialDelay)
}

// Helps spawn bullets from existing bullets
export function spawnBulletHelper(self, newBullet, amount, relativePos=true, relativeDir=true) { // handles bullet spawning
    newBullet = newBullet.clone()
    if (newBullet.dir === null) {
        newBullet.dir = Math.random()*360;
    } else if (relativeDir) {
        newBullet.dir += self.dir;
    }
    if (relativeDir) {
        for (let i = 0; i < 2; i++) {
            newBullet.pos[i] += self.pos[i];
        }
    }
    newBullet.initialPos = newBullet.pos
    newBullet.rotPrevPos = newBullet.pos
    // let newBulletList = [];
    for (let i = 0; i < amount; i++) {
        newBullet.renderDir = newBullet.dir;
        newBullet.rotDir = newBullet.dir;
        MBullet.bArr.push(newBullet.clone());
        newBullet.dir += 360/amount;
    }
    // Bullet.bArr.splice.apply(Bullet.bArr, [i+1, 0].concat(newBulletList));
}

// increases the length of a laser to a certain point
// LASERS NOT SUPPORTED YET
/*
export function moveLaserGrow(growAmount, growAccel=null, growCap=null, lengthCap=Math.sqrt(ce.screenDim[0]**2 + ce.screenDim[1]**2)) {
    return ["LaserGrow", growAmount, lengthCap, growAccel, growCap]
}
*/

// makes the bullet cycle through the colors (original color is overriden)
export function moveColorCycle(step, initialCycle=null) {
    return ["colorCycle", step, initialCycle]
}

// makes the bullet spin (only visual), if initialDir is null, starts on bullet direction
export function moveSpin(amount, initialDir=null) {
    // return ["spin", amount, initialDir]
    return {
        type: "spin",
        amount: amount,
        dir: initialDir
    }
}