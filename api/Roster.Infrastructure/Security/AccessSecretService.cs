namespace Roster.Infrastructure.Security;

using System.Security.Cryptography;
using System.Text;
using Roster.Application.Interfaces;

public class AccessSecretService : IAccessSecretService
{
    /// <summary>
    /// Generates a new team access secret.
    /// Returns (plaintext, hash) where plaintext is returned once to the caller
    /// and hash is stored in the TeamCreated event.
    /// </summary>
    public (string Plaintext, string Hash) GenerateSecret()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        var plaintext = Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_'); // URL-safe Base64, no padding

        var hash = ComputeHash(plaintext);
        return (plaintext, hash);
    }

    public string ComputeHash(string plaintext)
    {
        var hashBytes = SHA256.HashData(Encoding.UTF8.GetBytes(plaintext));
        return Convert.ToHexString(hashBytes).ToLowerInvariant();
    }
}
