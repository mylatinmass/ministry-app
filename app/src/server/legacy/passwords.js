const crypto = require("crypto")
const iterations = 100512 // Number of iterations
const keylen = 64 // Length of the hash
const digest = "sha512" // Hashing algorithm

// Method to hash a password and return a single string with both hash and salt
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex") // Generate a random salt

  return new Promise((resolve, reject) => {
    crypto.pbkdf2(
      password,
      salt,
      iterations,
      keylen,
      digest,
      (err, derivedKey) => {
        if (err) {
          reject(err)
          return
        }
        // Return the salt and hash combined in a single string (separated by ":")
        resolve(`${salt}:${derivedKey.toString("hex")}`)
      }
    )
  })
}

// Method to verify a password against the stored salt and hash
function verifyPassword(password, storedPassword) {
  if (typeof storedPassword !== "string") return Promise.resolve(false)

  // Split the stored password into salt, iterations, and hash
  const [salt, storedHash] = storedPassword.split(":")

  if (!salt || !storedHash || !/^[a-f0-9]+$/i.test(storedHash)) {
    return Promise.resolve(false)
  }

  return new Promise((resolve, reject) => {
    // Hash the input password with the extracted salt and iterations
    crypto.pbkdf2(
      password,
      salt,
      parseInt(iterations),
      keylen,
      digest,
      (err, derivedKey) => {
        if (err) {
          reject(err)
          return
        }

        const storedBuffer = Buffer.from(storedHash, "hex")

        resolve(
          storedBuffer.length === derivedKey.length &&
            crypto.timingSafeEqual(storedBuffer, derivedKey)
        )
      }
    )
  })
}

module.exports = {
  hashPassword,
  verifyPassword,
}
