// unused, out of program saving not implemented
class SaveData {
    /* LIMITATIONS:
        - cannot hold functions
        - objects stored cannot hold methods
        - objects lose parent class association
        - no compacting
    */
    static data = {}; // holds data to be converted to a string
    static typeDict = { // holds types and their shorter ids
        "string": "s",
        "number": "n",
        "object": "o",
        "boolean": "b",
        "undefined": "u",
        "bigint": "bi",
        "symbol": "sy",
    }

    static encrypt(str) { // lightly encrypts a string
        let output = "";
        for (let i = 0; i < str.length; i++) {
            output += String.fromCharCode(str.charCodeAt(i)+(i)%8);
        }
        return output;
    }

    static decrypt(str) { // decrypts a string
        let output = "";
        for (let i = 0; i < str.length; i++) {
            output += String.fromCharCode(str.charCodeAt(i)-(i)%8);
        }
        return output;
    }

    static getSaveString() { // generates a save string from data
        // merging
        let segArr = [];
        for (let id in this.data) {
            let seg = id + "/" + this.typeDict[this.data[id].type] + "/" + this.data[id].value.toString();
            segArr.push(seg);
        }
        let saveString = segArr.join('|');

        // return
        return this.encrypt(saveString)
    }

    static load(str) { // converts and stores save string into data
        str = this.decrypt(str);
        let segArr = str.split('|');
        let data = {};
        for (let i = 0; i < segArr.length; i++) {
            let seg = segArr[i].split('/');
            let d = new SaveData();
            d.type = Object.keys(this.typeDict).find(key => this.typeDict[key] === seg[1]);
            d.value = seg[2];
            data[seg[0]] = d;
        }
        this.data = data;
    }

    static clearData() { // clears data
        this.data = {};
    }

    static compressInt(val) {
        val = Math.floor(val);
        let output = "*";
        const mod = 62;
        let n = 0;
        while (mod**(n+1) <= val) {
            n++;
        }
        while (n >= 0) {
            let a = Math.floor(val / (mod**n));
            val -= a * mod**n;
            if (a > 35) {
                output += String.fromCharCode(a+61);
            } else if (a > 9) {
                output += String.fromCharCode(a+55);
            } else {
                output += a.toString();
            }
            n--;
        }
        return output;
    }

    static expandCompressedInt(val) {
        let output = 0;
        const mod = 62;
        if (val[0] === '*')
            val = val.substring(1);
        for (let n = 0; n < val.length; n++) {
            let a = val[val.length-n-1];
            let c = a.charCodeAt(0);
            if (c >= 97)
                c += -97 + 36;
            else if (c >= 65)
                c += -65 + 10;
            else
                c -= 48;
            output += c*(mod**n);
        }
        return output;
    }

    type; // type of the var
    value; // value of the var stored as a string
    constructor(name, value) { // holds data for a single variable
        this.type = typeof(value);
        switch (typeof value) {
            case "undefined":
                this.value = "";
                break;
            case "function":
                throw new Error("cannot save functions");
                break;
            case "string":
                this.value = value;
                break;
            case "boolean":
                this.value = (value)? "1" : "0";
                break;
            case "number":
                if (value % 1 === 0 && value > 0) {
                    let ci = SaveData.compressInt(value);
                    if (ci.length >= value.toString().length)
                        this.value = value.toString();
                    else
                        this.value = ci;
                } else {
                    this.value = value.toString();
                }
                break;
            default:
                this.value = JSON.stringify(value);
                break;
        }
        
        if (name != null) {
            SaveData.data[name] = this;
        }
    }

    read() { // reads the true value of the stored value
        switch(this.type) {
            case "undefined":
                return undefined;
            case "string":
                return this.value;
            case "boolean":
                return (this.value === "1");
            case "number":
                if (this.value[0] === "*") {
                    return SaveData.expandCompressedInt(this.value);
                } else {
                    return this.value.toString();
                }
            default:
                return JSON.parse(this.value)
        }
    }
}