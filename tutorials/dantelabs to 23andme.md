# Converting Whole Genome VCF to 23andMe Format with Real rsIDs

If you have a VCF file from whole genome sequencing (like from Dante Labs) and want to convert it to 23andMe format for analysis or database storage, you'll likely encounter a problem: most VCF files use "." instead of real rsIDs like "rs123456". This tutorial shows how to annotate your VCF with real rsIDs from dbSNP and convert it to the standard 23andMe format.

## Prerequisites

- VCF file from whole genome sequencing
- bcftools installed (`brew install bcftools` on macOS)
- Python 3
- About 50-75GB free disk space
- Basic command line knowledge

## Step 1: Identify Your Reference Genome

First, determine which reference genome your VCF uses. Check your sequencing report or look for a reference line in your VCF header:

```bash
grep "##reference" your_file.vcf
```

Common references:
- `hg19` or `GRCh37` (older, but still common)
- `hg38` or `GRCh38` (newer standard)

For this tutorial, we'll use **hg19/GRCh37** since many older sequencing files use this reference.

## Step 2: Check Chromosome Naming Format

Look at your VCF's chromosome naming:

```bash
grep -v "^#" your_file.vcf | head -5 | cut -f1
```

You'll see one of these formats:
- **UCSC format**: `chr1, chr2, chr3, chrX, chrY`
- **Simple format**: `1, 2, 3, X, Y`
- **NCBI format**: `NC_000001.11, NC_000002.12` (rare)

Remember your format - we'll need it later.

## Step 3: Download dbSNP Reference for hg19

Download the dbSNP database that matches your reference genome:

```bash
# Download dbSNP Build 155 for hg19 (GRCh37)
wget https://ftp.ncbi.nih.gov/snp/archive/b155/VCF/GCF_000001405.25.gz
wget https://ftp.ncbi.nih.gov/snp/archive/b155/VCF/GCF_000001405.25.gz.tbi

# Alternative: Build 154 if 155 is unavailable
# wget https://ftp.ncbi.nih.gov/snp/archive/b154/VCF/GCF_000001405.25.gz
# wget https://ftp.ncbi.nih.gov/snp/archive/b154/VCF/GCF_000001405.25.gz.tbi
```

**Note**: The `.gz` file is about 25GB and contains ~1 billion known variants with their rsIDs.

## Step 4: Fix Chromosome Naming Compatibility

The dbSNP file uses NCBI format (`NC_000001.11`) but your VCF likely uses UCSC format (`chr1`). We need to convert the dbSNP chromosome names to match yours.

### Download Chromosome Mapping File

```bash
wget https://raw.githubusercontent.com/Shicheng-Guo/AnnotationDatabase/master/GCF_000001405.25_GRCh37.p13_assembly_report.txt
```

### Create bcftools Mapping File

```bash
# Extract NCBI -> UCSC chromosome mapping
awk 'BEGIN { FS="\t" } !/^#/ { if ($10 != "na") print $7,$10; else print $7,$5 }' \
    GCF_000001405.25_GRCh37.p13_assembly_report.txt > chr_mapping.txt
```

### Convert dbSNP Chromosome Names

```bash
# Convert dbSNP chromosome names from NCBI to UCSC format
bcftools annotate --rename-chrs chr_mapping.txt GCF_000001405.25.gz | \
bcftools sort -Oz -o dbsnp_hg19_ucsc_sorted.vcf.gz

# Create index for the converted file (takes 30-60 minutes)
tabix -p vcf dbsnp_hg19_ucsc_sorted.vcf.gz
```

**Warning**: The sorting and indexing steps can take 30-60 minutes and require significant disk space.

## Step 5: Prepare Your VCF File

bcftools requires VCF files to be compressed with `bgzip` (not regular `gzip`) and indexed:

```bash
# If your file is compressed with regular gzip, decompress it first
gunzip your_file.vcf.gz  # if needed

# Compress with bgzip
bgzip your_file.vcf

# Create index
tabix -p vcf your_file.vcf.gz
```

## Step 6: Annotate Your VCF with Real rsIDs

Now we can add real rsIDs from dbSNP to your VCF:

```bash
bcftools annotate -a dbsnp_hg19_ucsc_sorted.vcf.gz -c ID your_file.vcf.gz -Oz -o annotated_with_rsids.vcf.gz
```

This process:
- Matches variants by chromosome, position, and alleles
- Adds real rsIDs (like `rs123456`) where matches are found
- Leaves unmatched variants with "." (these are likely novel variants)

## Step 7: Convert to 23andMe Format

Create a Python script to convert the annotated VCF to 23andMe format:

```python
#!/usr/bin/env python3

import sys
import gzip

def convert_genotype(gt_field, ref_allele, alt_allele):
    """Convert VCF genotype to 23andMe format"""
    if gt_field in ['./.' , '.', '']:
        return '--'
    
    # Split genotype (handle both / and | separators)
    if '/' in gt_field:
        alleles = gt_field.split('/')
    elif '|' in gt_field:
        alleles = gt_field.split('|')
    else:
        return '--'
    
    # Convert allele numbers to actual nucleotides
    result = ""
    for allele in alleles:
        if allele == '0':
            result += ref_allele
        elif allele == '1':
            result += alt_allele
        else:
            return '--'
    
    return result

def process_vcf(input_file, output_file):
    """Convert annotated VCF to 23andMe format"""
    
    # Handle compressed files
    if input_file.endswith('.gz'):
        f = gzip.open(input_file, 'rt')
    else:
        f = open(input_file, 'r')
    
    with f, open(output_file, 'w') as out:
        # Write 23andMe header
        out.write("rsid\tchromosome\tposition\tgenotype\n")
        
        for line in f:
            # Skip header lines
            if line.startswith('#'):
                continue
            
            fields = line.strip().split('\t')
            if len(fields) < 10:
                continue
                
            chrom = fields[0]
            pos = fields[1]
            rsid = fields[2]
            ref = fields[3]
            alt = fields[4]
            
            # Only process variants with real rsIDs
            if rsid == '.' or not rsid.startswith('rs'):
                continue
            
            # Get genotype from first sample
            format_field = fields[8]
            sample_field = fields[9]
            
            format_parts = format_field.split(':')
            sample_parts = sample_field.split(':')
            
            if 'GT' not in format_parts:
                continue
                
            gt_index = format_parts.index('GT')
            if gt_index >= len(sample_parts):
                continue
                
            gt_value = sample_parts[gt_index]
            
            # Convert genotype
            genotype = convert_genotype(gt_value, ref, alt)
            if genotype == '--':
                continue
            
            # Remove 'chr' prefix (23andMe uses 1,2,3... not chr1,chr2,chr3...)
            if chrom.startswith('chr'):
                chrom = chrom[3:]
            
            # Write to output
            out.write(f"{rsid}\t{chrom}\t{pos}\t{genotype}\n")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python vcf_to_23andme.py <input_vcf> <output_txt>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    print(f"Converting {input_file} to 23andMe format...")
    process_vcf(input_file, output_file)
    print(f"Done! Output written to {output_file}")
```

Save this as `vcf_to_23andme.py` and run:

```bash
python vcf_to_23andme.py annotated_with_rsids.vcf.gz genotypes_23andme.txt
```

## Step 8: Verify Results

Check your output:

```bash
# Look at the first few lines
head -10 genotypes_23andme.txt

# Count variants with rsIDs
wc -l genotypes_23andme.txt
```

Expected output format:
```
rsid        chromosome    position    genotype
rs123456    1            1234567     AT
rs789012    1            2345678     GG
rs345678    2            3456789     CT
```

## Step 9: Import to Database (Optional)

If you want to store this in PostgreSQL:

```sql
CREATE TABLE genotypes (
    rsid VARCHAR(50),
    chromosome VARCHAR(10), 
    position INTEGER,
    genotype VARCHAR(10)
);

CREATE INDEX idx_genotypes_rsid ON genotypes(rsid);
CREATE INDEX idx_genotypes_chr_pos ON genotypes(chromosome, position);

\copy genotypes FROM 'genotypes_23andme.txt' DELIMITER E'\t' CSV HEADER;
```

## Expected Results

From a whole genome sequence, you'll typically get:
- **4-5 million variants** with real rsIDs
- These are well-studied variants found in research databases
- Compatible with SNPedia lookups and genetic analysis tools
- Matches the format used by commercial genetic testing companies

## Common Issues and Solutions

**"Unsorted positions" error during tabix**
- Solution: Sort the VCF file first with `bcftools sort`

**"Could not retrieve index file" error**
- Solution: Ensure your VCF is compressed with `bgzip` and indexed with `tabix`

**"File write failed" during bcftools operations**
- Solution: Check available disk space (need ~50-75GB free)

**Very few variants get rsIDs**
- Solution: Check chromosome naming compatibility between your VCF and dbSNP file

## Summary

This process converts a raw whole genome VCF file into a clean, research-ready dataset with real rsIDs that can be easily analyzed, stored in databases, and compared with published genetic studies. The resulting 23andMe format file contains only the well-characterized variants that are most useful for genetic analysis and research.