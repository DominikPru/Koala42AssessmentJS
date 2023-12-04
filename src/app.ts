import express from 'express';
import { Pool } from 'pg';

const app = express();
const port = 3000;

const pool = new Pool({
  connectionString:
    'postgres://hvyvudcn:xvQqbJ22KEb7auJxdvpPyj5kbC@dontpanic.k42.app/postgres',
});

const charQuery = `
  SELECT * FROM character
`;
const nemesisQuery = `
  SELECT * FROM nemesis
`;
const secretQuery = `
  SELECT * FROM secret
`;

app.get("/", async (req: any, res: any) => {
  try {
    const responseData = await getData();
    res.json(responseData);
  } catch (error: any) {
    console.error("Error handling request:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

async function getData() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const [characterDataResult, nemesisDataResult, secretDataResult] =
      await Promise.all([
        client.query(charQuery),
        client.query(nemesisQuery),
        client.query(secretQuery),
      ]);
    await client.query("COMMIT");

    let organizedData = characterDataResult.rows.map((character) => {
      let characterNemesis = nemesisDataResult.rows
        .filter((nemesis) => nemesis.character_id === character.id)
        .map((nemesis) => {
          let nemesisSecrets = secretDataResult.rows.filter(
            (secret) => secret.nemesis_id === nemesis.id
          );

          if (!nemesis.has_secrets) {
            nemesis.has_secrets = [];
          }

          nemesis.has_secrets.push(...nemesisSecrets);

          return nemesis;
        });

      character.has_nemesis = characterNemesis;

      return character;
    });

    const responseData = {
      characters_count: characterDataResult.rows.length,
      nemesis_count: nemesisDataResult.rows.length,
      average_character_age: getAverageAge(characterDataResult.rows),
      average_nemesis_age: getAverage(
        nemesisDataResult.rows,
        (item) => item.years
      ),
      average_age_overall: getAverageOverall(characterDataResult.rows, nemesisDataResult.rows),
      average_character_weight: getAverage(
        characterDataResult.rows,
        (item) => item.weight
      ),
      genders: calculateGenderStatistics(characterDataResult.rows),
      data: organizedData,
    };

    return responseData;
  } catch (error: any) {
    console.error("Error executing query:", error.message);
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function getAverage(
  data: any[],
  propertyExtractor: (item: any) => any
): number | null {
  let totalAmount = 0;
  let validCount = 0;

  data.forEach((item: any) => {
    const value = propertyExtractor(item);

    if (value !== null && !isNaN(value)) {
      totalAmount += parseFloat(value);
      validCount++;
    }
  });

  return validCount > 0 ? totalAmount / validCount : null;
}


function calculateAge(dateOfBirth: string): number | null {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);

  if (isNaN(birthDate.getTime())) {
    // Invalid date string
    return null;
  }

  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  return age;
}

function getAverageAge(data: any[]): number | null {
  let totalAge = 0;

  data.forEach((item: any) => {
    const age = calculateAge(item.born);

    if (age !== null) {
      totalAge += age;
    }
  });

  return data.length > 0 ? totalAge / data.length : null;
}

function getAverageOverall(charData: any[], nemesisData: any[]): number | null {
  let totalAgeChar = 0;
  let totalAgeNem = 0;
  let countChar = 0;
  let countNem = 0;

  charData.forEach((item: any) => {
    const age = calculateAge(item.born);

    if (age !== null) {
      totalAgeChar += age;
      countChar++;
    }
  });

  nemesisData.forEach((item: any) => {
    if (item.years !== null) {
      totalAgeNem += item.years;
      countNem++;
    }
  });

  const overallAverageAge = (totalAgeChar + totalAgeNem) / (countChar + countNem);

  return overallAverageAge || null;
}

function calculateGenderStatistics(characterData: any[]) {
  let maleCount = 0;
  let femaleCount = 0;
  let otherCount = 0;

  characterData.forEach((character) => {
    const gender = character.gender?.toLowerCase();

    if (gender === 'm' || gender === 'male') {
      maleCount++;
    } else if (gender === 'f' || gender === 'female') {
      femaleCount++;
    } else {
      otherCount++;
    }
  });

  return {
    male: maleCount,
    female: femaleCount,
    other: otherCount,
  };
}

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
