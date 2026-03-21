namespace Roster.Domain.ValueObjects;
using Roster.Domain.Exceptions;

public sealed record SkillRating
{
    public int Value { get; }

    public SkillRating(int value)
    {
        if (value < 1 || value > 5)
            throw new DomainException($"Skill rating must be between 1 and 5, got {value}.");
        Value = value;
    }

    public static implicit operator int(SkillRating rating) => rating.Value;
}
