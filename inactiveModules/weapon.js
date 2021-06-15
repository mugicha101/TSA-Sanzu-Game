export {Weapon};
/* story time: so originally when forking the previous regionals game
    I planned on using the same engine to make a new game in which this, the saveData.js,
    inventory.js, worldGen.js, and PBullet were a part of. However, never really got far,
    and I ended up using this fork for the states version, which meant some remnants of
    the other game remain (like the one below).
*/

class Weapon {
    constructor(name, rarity, fireDelay, graphicDict, attackFunct, drawFunct) {
        this.name = name;
        /* rarities:
            - common
            - uncommon
            - rare
            - unique
            - artifact
        */
        this.rarity = rarity;
        this.fireDelay = fireDelay; // time in cycles
        this.delayCountdown = 0;
        this.attackFunct = attackFunct;
        this.graphicDict = graphicDict;
    }

    calc(triggerDown) {
        this.delayCountdown--;
        if (this.delayCountdown < 0)
            this.delayCountdown = 0;
        if (triggerDown && this.delayCountdown === 0) {
            this.delayCountdown = this.fireDelay;
            this.attackFunct(this);
        }
    }

    draw() {
        this.drawFunct(this);
    }
    
    static weapons = [
        new Weapon("Basic Handgun", "common", 30, {
        
        }, function(self) {

        }, function(self) {

        })
    ]
}