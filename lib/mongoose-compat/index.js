const admin = require("firebase-admin");
const path = require("path");

let db = null;

function convertTimestampsToDates(obj) {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    return obj.map(convertTimestampsToDates);
  }
  if (obj.constructor && (obj.constructor.name === "Timestamp" || typeof obj.toDate === "function")) {
    return obj.toDate();
  }
  const newObj = {};
  for (const [key, value] of Object.entries(obj)) {
    newObj[key] = convertTimestampsToDates(value);
  }
  return newObj;
}

function getNestedValue(obj, pathStr) {
  if (!obj) return undefined;
  const parts = pathStr.split(".");
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

function setNestedValue(obj, pathStr, value) {
  const parts = pathStr.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (part === "$" && Array.isArray(current)) {
      return; // Handled dynamically in applyUpdate
    }
    if (current[part] === undefined || current[part] === null || typeof current[part] !== "object") {
      current[part] = {};
    }
    current = current[part];
  }
  const lastPart = parts[parts.length - 1];
  current[lastPart] = value;
}

function ObjectIdWrapper(id) {
  if (id instanceof ObjectIdWrapper || (id && id.constructor && id.constructor.name === "ObjectIdWrapper")) {
    return id;
  }
  if (!(this instanceof ObjectIdWrapper)) {
    return new ObjectIdWrapper(id);
  }
  if (id) {
    this.id = id.toString();
  } else {
    this.id = db ? db.collection("users").doc().id : Math.random().toString(36).substring(2, 12) + Math.random().toString(36).substring(2, 12);
  }
}
ObjectIdWrapper.prototype.toString = function() { return this.id; };
ObjectIdWrapper.prototype.equals = function(other) { return this.id === (other ? other.toString() : ""); };
ObjectIdWrapper.prototype.toJSON = function() { return this.id; };
ObjectIdWrapper.isValid = (id) => {
  if (!id) return false;
  const s = id.toString();
  return typeof s === "string" && s.length >= 12 && s.length <= 30;
};

function matchQuery(doc, query) {
  if (!query) return true;
  for (const key of Object.keys(query)) {
    if (key === "$or") {
      if (!Array.isArray(query.$or)) return false;
      return query.$or.some(subQuery => matchQuery(doc, subQuery));
    }
    if (key === "$and") {
      if (!Array.isArray(query.$and)) return false;
      return query.$and.every(subQuery => matchQuery(doc, subQuery));
    }
    
    const val = query[key];
    const docVal = getNestedValue(doc, key);
    
    if (val && typeof val === "object" && !Array.isArray(val) && !(val instanceof Date) && !(val instanceof ObjectIdWrapper)) {
      for (const op of Object.keys(val)) {
        const opVal = val[op];
        if (op === "$gt") {
          if (!(docVal > opVal)) return false;
        } else if (op === "$lt") {
          if (!(docVal < opVal)) return false;
        } else if (op === "$gte") {
          if (!(docVal >= opVal)) return false;
        } else if (op === "$lte") {
          if (!(docVal <= opVal)) return false;
        } else if (op === "$ne") {
          const docValStr = docVal ? docVal.toString() : "";
          const opValStr = opVal ? opVal.toString() : "";
          if (docValStr === opValStr) return false;
        } else if (op === "$in") {
          if (!Array.isArray(opVal)) return false;
          const opValStrings = opVal.map(v => v ? v.toString() : "");
          if (Array.isArray(docVal)) {
            if (!docVal.some(dv => opValStrings.includes(dv ? dv.toString() : ""))) return false;
          } else {
            if (!opValStrings.includes(docVal ? docVal.toString() : "")) return false;
          }
        } else if (op === "$nin") {
          if (!Array.isArray(opVal)) return false;
          const opValStrings = opVal.map(v => v ? v.toString() : "");
          if (Array.isArray(docVal)) {
            if (docVal.some(dv => opValStrings.includes(dv ? dv.toString() : ""))) return false;
          } else {
            if (opValStrings.includes(docVal ? docVal.toString() : "")) return false;
          }
        } else if (op === "$exists") {
          const exists = docVal !== undefined && docVal !== null;
          if (exists !== !!opVal) return false;
        } else {
          if (docVal !== opVal) return false;
        }
      }
    } else {
      if (key === "_id") {
        const targetId = val ? val.toString() : "";
        const actualId = docVal ? docVal.toString() : "";
        if (actualId !== targetId) return false;
      } else if (Array.isArray(docVal)) {
        if (Array.isArray(val)) {
          if (docVal.length !== val.length || !docVal.every((v, i) => (v ? v.toString() : "") === (val[i] ? val[i].toString() : ""))) return false;
        } else {
          if (!docVal.map(v => v ? v.toString() : "").includes(val ? val.toString() : "")) return false;
        }
      } else {
        const docValStr = (docVal instanceof Date) ? docVal.getTime() : (docVal ? docVal.toString() : "");
        const valStr = (val instanceof Date) ? val.getTime() : (val ? val.toString() : "");
        if (docValStr !== valStr) return false;
      }
    }
  }
  return true;
}

function findPositionalIndex(doc, path, query) {
  if (!path.includes(".$")) return null;
  const prefix = path.split(".$")[0];
  const arr = getNestedValue(doc, prefix);
  if (!Array.isArray(arr)) return null;
  
  const prefixDot = prefix + ".";
  const arrayQuery = {};
  for (const [qKey, qVal] of Object.entries(query)) {
    if (qKey.startsWith(prefixDot)) {
      const subKey = qKey.slice(prefixDot.length);
      arrayQuery[subKey] = qVal;
    }
  }
  
  if (Object.keys(arrayQuery).length > 0) {
    for (let i = 0; i < arr.length; i++) {
      if (matchQuery(arr[i], arrayQuery)) {
        return i;
      }
    }
  }
  return 0;
}

function applyUpdate(doc, update, matchedIndex = null) {
  if (!update) return doc;
  
  const resolvePath = (path) => {
    if (path.includes(".$") && matchedIndex !== null) {
      return path.replace(".$.", `.${matchedIndex}.`);
    }
    return path;
  };

  if (update.$set) {
    for (const [key, value] of Object.entries(update.$set)) {
      const resolvedKey = resolvePath(key);
      setNestedValue(doc, resolvedKey, value);
    }
  }
  if (update.$unset) {
    for (const key of Object.keys(update.$unset)) {
      const resolvedKey = resolvePath(key);
      const parts = resolvedKey.split(".");
      let current = doc;
      for (let i = 0; i < parts.length - 1; i++) {
        current = current[parts[i]];
        if (!current) break;
      }
      if (current) {
        delete current[parts[parts.length - 1]];
      }
    }
  }
  if (update.$push) {
    for (const [key, value] of Object.entries(update.$push)) {
      const resolvedKey = resolvePath(key);
      let arr = getNestedValue(doc, resolvedKey);
      if (!Array.isArray(arr)) {
        arr = [];
        setNestedValue(doc, resolvedKey, arr);
      }
      if (value && value.$each) {
        arr.push(...value.$each);
      } else {
        arr.push(value);
      }
    }
  }
  if (update.$pull) {
    for (const [key, value] of Object.entries(update.$pull)) {
      const resolvedKey = resolvePath(key);
      let arr = getNestedValue(doc, resolvedKey);
      if (Array.isArray(arr)) {
        if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
          const filterQuery = value;
          const newArr = arr.filter(item => !matchQuery(item, filterQuery));
          setNestedValue(doc, resolvedKey, newArr);
        } else {
          const valStr = value ? value.toString() : "";
          const newArr = arr.filter(item => (item ? item.toString() : "") !== valStr);
          setNestedValue(doc, resolvedKey, newArr);
        }
      }
    }
  }
  if (update.$addToSet) {
    for (const [key, value] of Object.entries(update.$addToSet)) {
      const resolvedKey = resolvePath(key);
      let arr = getNestedValue(doc, resolvedKey);
      if (!Array.isArray(arr)) {
        arr = [];
        setNestedValue(doc, resolvedKey, arr);
      }
      const valStr = value ? value.toString() : "";
      if (!arr.some(item => (item ? item.toString() : "") === valStr)) {
        arr.push(value);
      }
    }
  }
  if (update.$inc) {
    for (const [key, value] of Object.entries(update.$inc)) {
      const resolvedKey = resolvePath(key);
      const currentVal = getNestedValue(doc, resolvedKey) || 0;
      setNestedValue(doc, resolvedKey, currentVal + value);
    }
  }
  return doc;
}

async function runPopulate(docs, populateSpecs) {
  const User = mongoose.models.User;
  if (!User || !docs || docs.length === 0 || !populateSpecs || populateSpecs.length === 0) return;
  
  for (const spec of populateSpecs) {
    const pathStr = spec.path;
    const select = spec.select;
    const parts = pathStr.split(".");
    
    if (parts.length === 1) {
      const field = parts[0];
      for (const doc of docs) {
        const val = doc[field];
        if (Array.isArray(val)) {
          const populatedList = [];
          for (const id of val) {
            if (id) {
              const u = await User.findById(id.toString()).select(select);
              if (u) populatedList.push(u);
            }
          }
          doc[field] = populatedList;
        } else if (val) {
          const u = await User.findById(val.toString()).select(select);
          doc[field] = u || null;
        }
      }
    } else if (parts.length === 2) {
      const [outerField, innerField] = parts;
      for (const doc of docs) {
        const arr = doc[outerField];
        if (Array.isArray(arr)) {
          for (const item of arr) {
            const val = item[innerField];
            if (val) {
              const u = await User.findById(val.toString()).select(select);
              item[innerField] = u || null;
            }
          }
        }
      }
    }
  }
}

class Document {
  constructor(model, data) {
    this._model = model;
    Object.assign(this, data);
    if (!this._id) {
      this._id = model.newId();
    }
    if (!this.createdAt) this.createdAt = new Date();
    if (!this.updatedAt) this.updatedAt = new Date();
  }
  
  async save() {
    if (this._model._schema && this._model._schema.hooks && this._model._schema.hooks.pre && this._model._schema.hooks.pre.save) {
      for (const hook of this._model._schema.hooks.pre.save) {
        await hook.call(this);
      }
    }
    
    this.updatedAt = new Date();
    const dataToSave = this.toObject();
    delete dataToSave._id;
    
    await this._model._collection.doc(this._id.toString()).set(dataToSave);
    return this;
  }
  
  toObject() {
    const obj = {};
    for (const key of Object.keys(this)) {
      if (key.startsWith("_") && key !== "_id") continue;
      obj[key] = this[key];
    }
    return JSON.parse(JSON.stringify(obj));
  }
  
  toJSON() {
    return this.toObject();
  }
}

class QueryChain {
  constructor(model, query, isFindOne = false) {
    this.model = model;
    this.query = query;
    this.isFindOne = isFindOne;
    this._sort = null;
    this._limit = null;
    this._skip = null;
    this._select = null;
    this._populate = [];
  }
  
  lean() { return this; }
  select(fields) { this._select = fields; return this; }
  sort(spec) { this._sort = spec; return this; }
  limit(n) { this._limit = n; return this; }
  skip(n) { this._skip = n; return this; }
  
  populate(path, select) {
    if (path && typeof path === "object") {
      this._populate.push(path);
    } else if (path) {
      this._populate.push({ path, select });
    }
    return this;
  }
  
  async then(onfulfilled, onrejected) {
    try {
      const res = await this.exec();
      return onfulfilled(res);
    } catch (err) {
      if (onrejected) return onrejected(err);
      throw err;
    }
  }
  
  async exec() {
    const results = await this.model._runFind(this.query, {
      sort: this._sort,
      limit: this.isFindOne ? 1 : this._limit,
      skip: this._skip,
      select: this._select,
      populate: this._populate
    });
    return this.isFindOne ? (results[0] || null) : results;
  }
}

class FirestoreModel {
  constructor(name, schema) {
    this.name = name;
    this.collectionName = name.toLowerCase() + "s";
    this._schema = schema;
  }
  
  get _collection() {
    if (!db) {
      throw new Error(`Database connection not initialized. Please call mongoose.connect() first.`);
    }
    return db.collection(this.collectionName);
  }
  
  newId() {
    return new ObjectIdWrapper(this._collection.doc().id);
  }
  
  async create(data) {
    if (Array.isArray(data)) {
      const instances = [];
      for (const item of data) {
        const doc = new Document(this, item);
        await doc.save();
        instances.push(doc);
      }
      return instances;
    } else {
      const doc = new Document(this, data);
      await doc.save();
      return doc;
    }
  }
  
  find(query) {
    return new QueryChain(this, query, false);
  }
  
  findOne(query) {
    return new QueryChain(this, query, true);
  }
  
  findById(id) {
    if (!id) return new QueryChain(this, { _id: null }, true);
    return new QueryChain(this, { _id: id.toString() }, true);
  }
  
  async updateOne(query, update) {
    const doc = await this.findOne(query);
    if (!doc) return { acknowledged: true, modifiedCount: 0 };
    const matchedIndex = findPositionalIndex(doc, Object.keys(update.$set || {})[0] || "", query);
    const updatedData = applyUpdate(doc.toObject(), update, matchedIndex);
    const id = doc._id.toString();
    delete updatedData._id;
    await this._collection.doc(id).set(updatedData);
    return { acknowledged: true, modifiedCount: 1 };
  }
  
  async updateMany(query, update) {
    const docs = await this.find(query);
    if (docs.length === 0) return { acknowledged: true, modifiedCount: 0 };
    const batch = db.batch();
    for (const doc of docs) {
      const matchedIndex = findPositionalIndex(doc, Object.keys(update.$set || {})[0] || "", query);
      const updatedData = applyUpdate(doc.toObject(), update, matchedIndex);
      const id = doc._id.toString();
      delete updatedData._id;
      batch.set(this._collection.doc(id), updatedData);
    }
    await batch.commit();
    return { acknowledged: true, modifiedCount: docs.length };
  }
  
  async findByIdAndUpdate(id, update, options = {}) {
    if (!id) return null;
    return this.findOneAndUpdate({ _id: id.toString() }, update, options);
  }
  
  async findOneAndUpdate(query, update, options = {}) {
    let doc = await this.findOne(query);
    if (!doc) {
      if (options.upsert) {
        const initialData = {};
        for (const [k, v] of Object.entries(query)) {
          if (!k.startsWith("$") && !k.includes(".")) {
            initialData[k] = v;
          }
        }
        if (update.$setOnInsert) {
          Object.assign(initialData, update.$setOnInsert);
        }
        const matchedIndex = findPositionalIndex(initialData, Object.keys(update.$set || {})[0] || "", query);
        const updatedData = applyUpdate(initialData, update, matchedIndex);
        const newDoc = new Document(this, updatedData);
        await newDoc.save();
        return newDoc;
      }
      return null;
    }
    
    const matchedIndex = findPositionalIndex(doc, Object.keys(update.$set || {})[0] || "", query);
    const originalData = doc.toObject();
    const updatedData = applyUpdate(doc.toObject(), update, matchedIndex);
    
    const docInstance = new Document(this, updatedData);
    await docInstance.save();
    
    return options.new ? docInstance : new Document(this, originalData);
  }
  
  async findByIdAndDelete(id) {
    if (!id) return null;
    const doc = await this.findById(id);
    if (!doc) return null;
    await this._collection.doc(id.toString()).delete();
    return doc;
  }
  
  async deleteOne(query) {
    const doc = await this.findOne(query);
    if (!doc) return { acknowledged: true, deletedCount: 0 };
    await this._collection.doc(doc._id.toString()).delete();
    return { acknowledged: true, deletedCount: 1 };
  }
  
  async deleteMany(query) {
    const docs = await this.find(query);
    if (docs.length === 0) return { acknowledged: true, deletedCount: 0 };
    const batch = db.batch();
    for (const doc of docs) {
      batch.delete(this._collection.doc(doc._id.toString()));
    }
    await batch.commit();
    return { acknowledged: true, deletedCount: docs.length };
  }
  
  async countDocuments(query) {
    const docs = await this.find(query);
    return docs.length;
  }
  
  async _runFind(query, options) {
    let ref = this._collection;
    
    if (query) {
      if (query._id) {
        const docId = query._id.toString();
        const docSnap = await ref.doc(docId).get();
        if (!docSnap.exists) return [];
        const data = convertTimestampsToDates(docSnap.data());
        const docObj = new Document(this, { _id: docSnap.id, ...data });
        if (matchQuery(docObj, query)) {
          return [docObj];
        }
        return [];
      }
      
      const possibleDirectFilters = ["email", "recoveryPin", "conversationId", "senderId", "receiverId", "seen", "resolved", "pairKey"];
      for (const key of possibleDirectFilters) {
        if (query[key] !== undefined && typeof query[key] !== "object") {
          ref = ref.where(key, "==", query[key]);
        }
      }
      
      if (query.participants && typeof query.participants !== "object") {
        ref = ref.where("participants", "array-contains", query.participants);
      }
    }
    
    const snapshot = await ref.get();
    let results = [];
    snapshot.forEach(docSnap => {
      const data = convertTimestampsToDates(docSnap.data());
      results.push(new Document(this, { _id: docSnap.id, ...data }));
    });
    
    if (query) {
      results = results.filter(doc => matchQuery(doc, query));
    }
    
    if (options.sort) {
      const sortFields = Object.keys(options.sort);
      results.sort((a, b) => {
        for (const field of sortFields) {
          const order = options.sort[field];
          const valA = getNestedValue(a, field);
          const valB = getNestedValue(b, field);
          
          if (valA === valB) continue;
          
          const isAsc = order === 1 || order === "asc" || order === "ascending";
          
          if (valA === undefined || valA === null) return isAsc ? -1 : 1;
          if (valB === undefined || valB === null) return isAsc ? 1 : -1;
          
          const cmpA = (valA instanceof Date) ? valA.getTime() : valA;
          const cmpB = (valB instanceof Date) ? valB.getTime() : valB;
          
          if (cmpA < cmpB) return isAsc ? -1 : 1;
          if (cmpA > cmpB) return isAsc ? 1 : -1;
        }
        return 0;
      });
    }
    
    if (options.skip) {
      results = results.slice(options.skip);
    }
    
    if (options.limit) {
      results = results.slice(0, options.limit);
    }
    
    if (options.select) {
      let selectFields = [];
      let isExclude = false;
      
      if (typeof options.select === "string") {
        const parts = options.select.trim().split(/\s+/);
        if (parts[0].startsWith("-")) {
          isExclude = true;
          selectFields = parts.map(p => p.slice(1));
        } else {
          selectFields = parts;
        }
      } else if (typeof options.select === "object") {
        for (const [k, v] of Object.entries(options.select)) {
          if (v === 0) {
            isExclude = true;
            selectFields.push(k);
          } else {
            selectFields.push(k);
          }
        }
      }
      
      if (selectFields.length > 0) {
        results = results.map(doc => {
          const obj = doc.toObject();
          const projected = { _id: doc._id };
          
          if (isExclude) {
            for (const [k, v] of Object.entries(obj)) {
              if (!selectFields.includes(k)) {
                projected[k] = v;
              }
            }
          } else {
            for (const field of selectFields) {
              projected[field] = getNestedValue(obj, field);
            }
          }
          
          return new Document(this, projected);
        });
      }
    }
    
    if (options.populate && options.populate.length > 0) {
      await runPopulate(results, options.populate);
    }
    
    return results;
  }
}

function connect(uri, options) {
  try {
    if (admin.apps.length === 0) {
      const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT;
      const projectId = process.env.FIREBASE_PROJECT_ID;
      
      if (serviceAccountPath) {
        const serviceAccount = require(path.resolve(serviceAccountPath));
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
      } else if (projectId) {
        admin.initializeApp({ projectId });
      } else {
        admin.initializeApp();
      }
    }
    db = admin.firestore();
    db.settings({ ignoreUndefinedProperties: true });
  } catch (err) {
    console.error("⚠️ Firebase initialization warning:", err.message);
    if (admin.apps.length === 0) {
      admin.initializeApp({ projectId: "startupsync-dummy-project" });
      db = admin.firestore();
      db.settings({ ignoreUndefinedProperties: true });
    }
  }
  return Promise.resolve(mongoose);
}

class Schema {
  constructor(definition, options) {
    this.definition = definition;
    this.options = options;
    this.hooks = { pre: {}, post: {} };
    this.indexes = [];
  }
  pre(event, fn) {
    if (!this.hooks.pre[event]) this.hooks.pre[event] = [];
    this.hooks.pre[event].push(fn);
    return this;
  }
  post(event, fn) {
    if (!this.hooks.post[event]) this.hooks.post[event] = [];
    this.hooks.post[event].push(fn);
    return this;
  }
  index(fields, options) {
    this.indexes.push({ fields, options });
    return this;
  }
}
Schema.Types = {
  ObjectId: ObjectIdWrapper,
  String,
  Number,
  Boolean,
  Date,
  Mixed: Object,
  Map: Map
};

const mongoose = {
  Schema,
  models: {},
  model(name, schema) {
    if (this.models[name]) return this.models[name];
    const m = new FirestoreModel(name, schema);
    this.models[name] = m;
    return m;
  },
  connect,
  disconnect() { return Promise.resolve(); },
  connection: {
    on(event, cb) {
      if (event === "connected") {
        setTimeout(cb, 100);
      }
    }
  },
  Types: {
    ObjectId: ObjectIdWrapper
  }
};

module.exports = mongoose;
