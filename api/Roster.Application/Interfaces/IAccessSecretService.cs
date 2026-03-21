namespace Roster.Application.Interfaces;

public interface IAccessSecretService
{
    (string Plaintext, string Hash) GenerateSecret();
    string ComputeHash(string plaintext);
}
