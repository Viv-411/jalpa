// The name typed on the sign-up form, used when the profile is first created.
let pendingName = ''

export function setPendingName(name) {
  pendingName = name
}

export function takePendingName() {
  return pendingName
}

export function cleanName(value) {
  return (value ?? '').replace(/\s+/g, ' ').trim().slice(0, 30)
}
