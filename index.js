class query {
  constructor(data) {
    this.data = data;
  }
  where(predicate) {
    this.data = this.data.filter(predicate)
    return this
  }
  orderBy(key) {
    this.data = this.data.sort((a, b) => a[key] - b[key])
    return this
  }
  groupBy(key) {
    let obj = {}
    this.data.forEach((i) => {
      if (obj[i[key]]) {
        obj[i[key]].push(i)
      } else {
        obj[i[key]] = [i]
      }
    })
    this.data = Object.values(obj)
    return this
  }
  execute() {
    return this.data;
  }
}

const data = [
  { name: 'foo', age: 16, city: 'shanghai' },
  { name: 'bar', age: 24, city: 'hangzhou' },
  { name: 'fiz', age: 22, city: 'shanghai' },
  { name: 'baz', age: 19, city: 'hangzhou' },
];

const instance = new query(data)
const result2 = instance.groupBy('city').execute()

console.log(result2)