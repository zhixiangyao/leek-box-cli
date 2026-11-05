if (typeof Map.prototype.getOrInsertComputed === 'undefined') {
  Map.prototype.getOrInsertComputed = function <K, V>(key: K, callbackFn: (key: K) => V): V {
    if (this.has(key)) {
      return this.get(key)
    }
    const value = callbackFn(key)
    this.set(key, value)
    return value
  }
}
